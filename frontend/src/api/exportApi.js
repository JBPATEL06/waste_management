import { api } from './client';

export const exportApi = {
  download: async (dataset, format, filters = {}) => {
    const searchParams = new URLSearchParams({ format });
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    }
    const endpoint = `/export/${dataset}?${searchParams.toString()}`;
    const blob = await api.get(endpoint);

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

