import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// In-memory access token storage
let memoryToken: string | null = null;

export const getAccessToken = () => memoryToken;
export const setAccessToken = (token: string | null) => {
  memoryToken = token;
};

// Create Axios Instance
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Crucial for cookie handling
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach bearer access token
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Single-flight refresh: the server rotates the refresh token on every use
// and revokes the whole session if the old token is presented twice, so all
// callers (mount-time silent refresh, concurrent 401 retries, StrictMode
// double-mount) must share ONE in-flight request.
let refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        const token = response.data?.data?.accessToken;
        if (!token) {
          throw new Error('Refresh response did not include an access token.');
        }
        setAccessToken(token);
        return token;
      })
      .catch((error) => {
        setAccessToken(null);
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Response Interceptor: Silent refresh on 401 expirations
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401, not already retried, and not an auth endpoint
    // (a 401 from /auth/refresh itself must not trigger another refresh)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        // Concurrent 401s all await the same single-flight refresh
        const newAccessToken = await refreshAccessToken();

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed: session is gone, redirect to login preserving location
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
