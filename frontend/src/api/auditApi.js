import { api } from './client';

export const auditApi = {
  getLogs: (params = {}) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    }
    const query = searchParams.toString();
    return api.get(`/audit${query ? `?${query}` : ''}`);
  },
};

