import { api } from './client';

export const entriesApi = {
  createEntry: (batchId, data) => api.post(`/batches/${batchId}/entries`, data),

  correctEntry: (entryId, data) => api.post(`/entries/${entryId}/correct`, data),

  updateEntry: (entryId, data) => api.patch(`/entries/${entryId}`, data),

  deleteEntry: (entryId, reason) => api.delete(`/entries/${entryId}`, { reason }),
};

