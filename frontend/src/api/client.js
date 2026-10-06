/**
 * Centralized API Client with In-Memory Access Token Management & Automatic 401 Token Refresh
 */

const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

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

export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
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
    response = await fetch(url, fetchOptions);
  } catch (netErr) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network connection failed. Please check your internet connection.');
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
      const refreshRes = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

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
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.');
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
    const errorObj = data?.error || {};
    throw new ApiError(
      response.status,
      errorObj.code || `HTTP_${response.status}`,
      errorObj.message || data?.message || response.statusText || 'An error occurred',
      errorObj.details || null
    );
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

