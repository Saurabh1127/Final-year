import axios from 'axios';

// In production (Vercel), VITE_API_URL must point to the Railway backend.
// In dev, it falls back to '' which uses the Vite proxy.
const API_BASE = import.meta.env.VITE_API_URL || '';
const API_URL = `${API_BASE.replace(/\/$/, '')}/api`;

console.log('[API] Base URL:', API_BASE || '(using dev proxy)');
console.log('[API] Full URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
