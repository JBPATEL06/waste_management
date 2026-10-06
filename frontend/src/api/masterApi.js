import { api } from './client';

export const masterApi = {
  getItems: (type, params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.is_active !== undefined) searchParams.set('is_active', params.is_active);
    const query = searchParams.toString();
    return api.get(`/master/${type}${query ? `?${query}` : ''}`);
  },

  getRoutes: (params = {}) => masterApi.getItems('routes', params),
  getVehicles: (params = {}) => masterApi.getItems('vehicles', params),
  getRtsLocations: (params = {}) => masterApi.getItems('rts_locations', params),
  getFacilities: (params = {}) => masterApi.getItems('processing_facilities', params),
  getProcessingFacilities: (params = {}) => masterApi.getItems('processing_facilities', params),
  getProcessTypes: (params = {}) => masterApi.getItems('process_types', params),
  getWasteCategories: (params = {}) => masterApi.getItems('waste_categories', params),
  getDrivers: (params = {}) => masterApi.getItems('drivers', params),

  createItem: (type, data) => api.post(`/master/${type}`, data),

  updateItem: (type, id, data) => api.patch(`/master/${type}/${id}`, data),

  deactivateItem: (type, id) => api.patch(`/master/${type}/${id}/deactivate`, {}),

  deleteItem: (type, id) => api.delete(`/master/${type}/${id}`),
};

