import axios from 'axios';

const ACCESS = 'la_access_token';
const REFRESH = 'la_refresh_token';

// Tokens live in localStorage so a reload keeps you signed in. See README (Security) for the trade-off vs httpOnly cookies.
export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS),
  getRefresh: () => localStorage.getItem(REFRESH),
  set: ({ accessToken, refreshToken }) => {
    if (accessToken) localStorage.setItem(ACCESS, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 200000, // analysis can take a while on long documents
});

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];
let refreshing = null; // shared so parallel 401s trigger only one refresh

async function refreshTokens() {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');
  const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
  tokenStore.set(data);
  return data.accessToken;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = AUTH_PATHS.some((p) => config?.url?.startsWith(p));

    if (response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        refreshing = refreshing || refreshTokens().finally(() => (refreshing = null));
        const token = await refreshing;
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch {
        tokenStore.clear();
        window.dispatchEvent(new Event('auth:logout'));
      }
    }
    return Promise.reject(error);
  }
);

export const errorMessage = (err) => {
  const data = err?.response?.data;
  const message = data?.message;
  const details = Array.isArray(data?.details)
    ? data.details.map((item) => (typeof item === 'string' ? item : item?.message)).filter(Boolean)
    : [];
  if (message && details.length) return `${message}: ${details[0]}`;
  return message || (err?.code === 'ECONNABORTED' ? 'The request took too long. Try again.' : err?.message) || 'Something went wrong';
};

export default api;
