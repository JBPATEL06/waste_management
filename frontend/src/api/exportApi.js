import { api } from './client';

export const exportApi = {
  preview: (dataset, filters = {}) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    }
    const query = searchParams.toString();
    return api.get(`/export/${dataset}/preview${query ? `?${query}` : ''}`);
  },

  download: async (dataset, format, filters = {}) => {
    const searchParams = new URLSearchParams({ format });
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    }
    const endpoint = `/export/${dataset}?${searchParams.toString()}`;
    const resData = await api.get(endpoint);

    // Ensure we have a Blob (api.get returns string for text/csv responses)
    const blob =
      resData instanceof Blob
        ? resData
        : new Blob([resData], {
            type:
              format === 'xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv;charset=utf-8;',
          });

    // Create trigger for browser download
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${dataset}_export_${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },
};
