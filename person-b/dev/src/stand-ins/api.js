// STAND-IN for Person A's apps/web/src/lib/api.js — copied from A's plan (section 6), not a new design.
// One axios client for the whole app; every response is { data: ... }, unwrapped once here.
import axios from 'axios';
import { useAuth } from './auth';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8090' });

api.interceptors.request.use(cfg => {
  const token = useAuth.getState().token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(r => r.data.data, e => Promise.reject(e.response?.data?.error || e));
