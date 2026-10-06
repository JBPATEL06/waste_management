import { api } from './client';

export const publicApi = {
  trackBatch: (batchCode) => api.get(`/public/track/${encodeURIComponent(batchCode)}`),
};

