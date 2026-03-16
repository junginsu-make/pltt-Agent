import { create } from 'zustand';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  login: (token: string, user: AdminUser) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      const userStr = localStorage.getItem('admin_user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr) as AdminUser;
          set({ token, user, isAuthenticated: true });
        } catch {
          set({ token: null, user: null, isAuthenticated: false });
        }
      }
    }
  },
}));
