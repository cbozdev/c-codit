import { create } from 'zustand';
import { apiCall, getToken, setToken } from '@/lib/api';
import type { User } from '@/types/api';

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone?: string;
    country?: string;
    accept_terms: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: getToken(),
  loading: false,
  initialized: false,

  async initialize() {
    if (get().initialized) return;
    const token = getToken();
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await apiCall<User>({ method: 'GET', url: '/auth/me' });
      set({ user, token, initialized: true });
    } catch {
      setToken(null);
      set({ user: null, token: null, initialized: true });
    }
  },

  async login(email, password) {
    set({ loading: true });
    try {
      const data = await apiCall<{ user: User; token: string }>({
        method: 'POST',
        url: '/auth/login',
        data: { email, password },
      });
      setToken(data.token);
      set({ user: data.user, token: data.token });
    } finally {
      set({ loading: false });
    }
  },

  async register(input) {
    set({ loading: true });
    try {
      const data = await apiCall<{ user: User; token: string }>({
        method: 'POST',
        url: '/auth/register',
        data: input,
      });
      setToken(data.token);
      set({ user: data.user, token: data.token });
    } finally {
      set({ loading: false });
    }
  },

  async logout() {
    try {
      await apiCall({ method: 'POST', url: '/auth/logout' });
    } catch {
      /* ignore */
    } finally {
      setToken(null);
      set({ user: null, token: null });
    }
  },

  async refresh() {
    const user = await apiCall<User>({ method: 'GET', url: '/auth/me' });
    set({ user });
  },
}));
