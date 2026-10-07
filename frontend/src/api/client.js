/**
 * Centralized API Client with In-Memory Access Token Management & Automatic 401 Token Refresh
 */
import { toastBus } from '../utils/toastBus';

const BASE_URL = (import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

function buildUrl(endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (BASE_URL && cleanEndpoint.startsWith(BASE_URL)) {
    return cleanEndpoint;
  }
  return `${BASE_URL}${cleanEndpoint}`;
}

let inMemoryAccessToken = null;
let isRefreshing = false;
let failedQueue = [];
let lastSessionExpiredToast = 0;

function fetchWithRefreshLock(request) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('wasteflow-auth-refresh', request);
  }
  return request();
}

function emitSessionExpiredToast() {
  const now = Date.now();
  if (now - lastSessionExpiredToast > 3000) {
    lastSessionExpiredToast = now;
    toastBus.emit('error', 'Session expired, please log in again');
  }
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function setAccessToken(token) {
  inMemoryAccessToken = token;
}

export function clearAccessToken() {
  inMemoryAccessToken = null;
}

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

function extractFieldErrors(data) {
  const fieldErrors = {};
  if (!data) return fieldErrors;

  const rawDetails = data?.error?.details || data?.errors || data?.error?.errors || data?.details;

  if (Array.isArray(rawDetails)) {
    rawDetails.forEach((err) => {
      if (typeof err === 'string') {
        fieldErrors.general = err;
      } else if (err && typeof err === 'object') {
        const lastPath = Array.isArray(err.path) ? err.path[err.path.length - 1] : err.path;
        const field = err.field || lastPath || err.param || err.key;
        const msg = err.message || err.msg || err.error || 'Invalid value';
        if (field) {
          fieldErrors[field] = msg;
        }
      }
    });
  } else if (rawDetails && typeof rawDetails === 'object') {
    Object.entries(rawDetails).forEach(([k, v]) => {
      if (typeof v === 'string') {
        fieldErrors[k] = v;
      } else if (v && typeof v === 'object') {
        fieldErrors[k] = v.message || v.msg || JSON.stringify(v);
      }
    });
  }
  return fieldErrors;
}

export class ApiError extends Error {
  constructor(status, code, message, details = null, fieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.message = message;
    this.details = details;
    this.fieldErrors = fieldErrors || {};
    this.response = {
      status,
      data: details || { error: { code, message, details } }
    };
  }
}

/**
 * Core HTTP fetch wrapper with interceptors
 */
export async function apiFetch(endpoint, options = {}, isRetry = false) {
  const url = buildUrl(endpoint);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: 'include', // withCredentials for httpOnly refresh cookies
  };

  let response;
  try {
    response = endpoint.includes('/auth/refresh')
      ? await fetchWithRefreshLock(() => fetch(url, fetchOptions))
      : await fetch(url, fetchOptions);
  } catch (netErr) {
    const err = new ApiError(0, 'NETWORK_ERROR', 'Network connection failed. Please check your internet connection.', null, {});
    err.status = 0;
    err.code = 'NETWORK_ERROR';
    err.message = 'Network connection failed. Please check your internet connection.';
    err.fieldErrors = {};
    throw err;
  }

  // Handle 401 Unauthorized with single token refresh
  if (response.status === 401 && !isRetry && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          return apiFetch(endpoint, options, true);
        })
        .catch((err) => {
          throw err;
        });
    }

    isRefreshing = true;

    try {
      const refreshRes = await fetchWithRefreshLock(() =>
        fetch(buildUrl('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
      );

      if (!refreshRes.ok) {
        throw new Error('Refresh token invalid or expired');
      }

      const refreshData = await refreshRes.json();
      setAccessToken(refreshData.accessToken);
      processQueue(null, refreshData.accessToken);

      return apiFetch(endpoint, options, true);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      clearAccessToken();
      // Dispatch custom event for AuthContext to catch and redirect
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      emitSessionExpiredToast();
      const expiredError = new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.', null, {});
      expiredError.status = 401;
      expiredError.code = 'SESSION_EXPIRED';
      expiredError.message = 'Your session has expired. Please log in again.';
      expiredError.fieldErrors = {};
      throw expiredError;
    } finally {
      isRefreshing = false;
    }
  }

  // Read response
  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType.includes('text/')) {
    data = await response.text();
  } else {
    data = await response.blob();
  }

  if (!response.ok) {
    const errorObj = (typeof data === 'object' && data !== null) ? (data.error || data) : {};
    const status = response.status;
    const code = errorObj.code || (status === 422 ? 'VALIDATION_FAILED' : `HTTP_${status}`);
    const message = errorObj.message || (typeof data === 'string' ? data : null) || response.statusText || 'An error occurred';
    const fieldErrors = extractFieldErrors(data);

    const apiError = new ApiError(
      status,
      code,
      message,
      data?.error?.details || data?.errors || null,
      fieldErrors
    );
    apiError.status = status;
    apiError.code = code;
    apiError.message = message;
    apiError.fieldErrors = fieldErrors;
    apiError.response = {
      status,
      data,
    };
    throw apiError;
  }

  return data;
}

export const api = {
  get: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: (endpoint, body = null, options = {}) =>
    apiFetch(endpoint, {
      ...options,
      method: 'DELETE',
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
};
