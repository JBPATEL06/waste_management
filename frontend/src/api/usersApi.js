import { api } from './client';

export const usersApi = {
  getUsers: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.role) searchParams.set('role', params.role);
    if (params.is_active !== undefined) searchParams.set('is_active', params.is_active);
    if (params.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return api.get(`/users${query ? `?${query}` : ''}`);
  },

  createUser: (data) => api.post('/users', data),

  updateUser: (id, data) => api.patch(`/users/${id}`, data),

  resetPassword: (id) => api.post(`/users/${id}/reset-password`, {}),

  deactivateUser: (id) => api.patch(`/users/${id}/deactivate`, {}),
};

