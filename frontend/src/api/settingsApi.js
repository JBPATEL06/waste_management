import { api } from './client';

export const settingsApi = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.patch('/settings', data),
};

