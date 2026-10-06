import { api } from './client';

export const meApi = {
  getProfile: () => api.get('/me'),
  updateProfile: (name) => api.patch('/me', { name }),
  getHistory: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    const query = searchParams.toString();
    return api.get(`/me/history${query ? `?${query}` : ''}`);
  },
};

