import { api } from './client';

export const batchesApi = {
  getBatches: (params = {}) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    }
    const query = searchParams.toString();
    return api.get(`/batches${query ? `?${query}` : ''}`);
  },

  getBatch: (id) => api.get(`/batches/${id}`),

  createBatch: (data) => api.post('/batches', data),

  updateBatch: (id, data) => api.patch(`/batches/${id}`, data),

  reassignBatch: (id, payload) => api.put(`/batches/${id}/assignments`, payload),

  deleteBatch: (id, data) => api.delete(`/batches/${id}`, data),

  getBatchQr: (id) => api.get(`/batches/${id}/qr`),
};

