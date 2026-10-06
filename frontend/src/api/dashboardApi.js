import { api } from './client';

export const dashboardApi = {
  getSummary: (params = {}) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    }
    const query = searchParams.toString();
    return api.get(`/dashboard/summary${query ? `?${query}` : ''}`);
  },

  getBreakdowns: (params = {}) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    }
    const query = searchParams.toString();
    return api.get(`/dashboard/breakdowns${query ? `?${query}` : ''}`);
  },

  getPending: () => api.get('/dashboard/pending'),

  getRecent: () => api.get('/dashboard/recent'),

  getQueue: () => api.get('/dashboard/queue'),
};

