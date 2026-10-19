import api, { tokenStore } from './api.js';

const data = (p) => p.then((r) => r.data);

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const authService = {
  register: (body) => data(api.post('/auth/register', body)),
  login: (body) => data(api.post('/auth/login', body)),
  validate: () => data(api.get('/auth/validate')),
  logout: async () => {
    try {
      await api.post('/auth/logout', { refreshToken: tokenStore.getRefresh() });
    } finally {
      tokenStore.clear();
    }
  },
  forgotPassword: (email) => data(api.post('/auth/forgot-password', { email })),
  resetPassword: (token, password) => data(api.post('/auth/reset-password', { token, password })),
  changePassword: (body) => data(api.post('/auth/change-password', body)),
};

export const documentService = {
  list: (params) => data(api.get('/documents', { params })),
  get: (id) => data(api.get(`/documents/${id}`)),
  upload: (file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return data(
      api.post('/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      })
    );
  },
  remove: (id) => data(api.delete(`/documents/${id}`)),
  analyze: (id) => data(api.post(`/documents/${id}/analyze`)),
  reprocess: (id) => data(api.post(`/documents/${id}/reprocess`)),
  download: async (id, name) => saveBlob((await api.get(`/documents/${id}/download`, { responseType: 'blob' })).data, name),
  report: async (id, name) => saveBlob((await api.get(`/documents/${id}/report`, { responseType: 'blob' })).data, `${name.replace(/\.[^.]+$/, '')}-analysis.md`),
};

export const chatService = {
  ask: (documentId, question) => data(api.post(`/chat/${documentId}`, { question })),
  list: (documentId) => data(api.get(`/chat/${documentId}`)),
  clear: (documentId) => data(api.delete(`/chat/${documentId}`)),
  history: (params) => data(api.get('/chat', { params })),
};

export const userService = {
  update: (name) => data(api.put('/user/profile', { name })),
  activity: () => data(api.get('/user/activity')),
  deleteAccount: (password) => data(api.delete('/user/account', { data: { password } })),
};

export const dashboardService = {
  stats: () => data(api.get('/dashboard/stats')),
};
