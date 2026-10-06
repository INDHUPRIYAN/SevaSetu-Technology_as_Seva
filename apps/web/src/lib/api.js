// apps/web/src/lib/api.js — one axios client for the whole app
import axios from 'axios';
import { useAuth } from './auth';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080' });

api.interceptors.request.use(cfg => {
  const token = useAuth.getState().token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// every response is { data: ... } so unwrap it once here.
// A 401 means the token is gone or expired: log out, and the router sends the user to /login.
api.interceptors.response.use(
  r => r.data.data,
  e => {
    if (e.response?.status === 401 && useAuth.getState().token) useAuth.getState().logout();
    return Promise.reject(e.response?.data?.error || { message: 'Could not reach SevaSetu. Please try again.' });
  }
);
