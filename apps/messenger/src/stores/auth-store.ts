'use client';
import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  team: { id: string; name: string };
  position: string;
  avatarUrl: string | null;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: (token, user) => {
    localStorage.setItem('palette_token', token);
    localStorage.setItem('palette_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('palette_token');
    localStorage.removeItem('palette_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('palette_token');
    const userStr = localStorage.getItem('palette_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true });
      } catch {
        /* ignore parse errors */
      }
    }
  },
}));
