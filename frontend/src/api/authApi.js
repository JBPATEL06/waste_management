import { api, clearAccessToken, setAccessToken } from './client';

export const authApi = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.accessToken) {
      setAccessToken(res.accessToken);
    }
    return res;
  },

  refresh: async () => {
    const res = await api.post('/auth/refresh', {});
    if (res.accessToken) {
      setAccessToken(res.accessToken);
    }
    return res;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {});
    } finally {
      clearAccessToken();
    }
  },

  logoutAll: async () => {
    try {
      await api.post('/auth/logout-all', {});
    } finally {
      clearAccessToken();
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    if (res.accessToken) {
      setAccessToken(res.accessToken);
    }
    return res;
  },
};

