import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import type { ApiEnvelope } from '@/types/api';

const baseURL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 30_000,
});

const TOKEN_KEY = 'ccodit_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiEnvelope<unknown>>) => {
    const status = err.response?.status;

    if (status === 401) {
      // Token expired or invalid: clear and redirect to login.
      setToken(null);
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }
    }

    if (status === 429) {
      toast.error('Too many requests. Please slow down.');
    }
    if (status && status >= 500) {
      toast.error('Server error. Please try again.');
    }

    return Promise.reject(err);
  },
);

/** Generate a fresh idempotency key for write requests. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'k_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Convenience wrapper that unwraps the ApiEnvelope and surfaces messages. */
export async function apiCall<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const res = await api.request<ApiEnvelope<T>>(config);
    return res.data.data;
  } catch (err) {
    const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
    const msg = axiosErr.response?.data?.message ?? axiosErr.message ?? 'Request failed.';
    throw new Error(msg);
  }
}

/** Extract validation errors from a 422 response, if any. */
export function extractFieldErrors(err: unknown): Record<string, string[]> | null {
  const e = err as AxiosError<ApiEnvelope<{ errors?: Record<string, string[]> }>>;
  return e.response?.data?.data?.errors ?? null;
}
