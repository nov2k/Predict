import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  handle: string;
  avatar: string;
  balance: number;
  email?: string;
}

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  hasDoneFakeBet: boolean;
  language: 'en' | 'ru';
  setUser: (user: User | null) => void;
  setHasDoneFakeBet: (val: boolean) => void;
  setLanguage: (lang: 'en' | 'ru') => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      hasDoneFakeBet: false,
      language: 'en',
      setUser: (user) => set({ user, isLoggedIn: !!user }),
      setHasDoneFakeBet: (val) => set({ hasDoneFakeBet: val }),
      setLanguage: (language) => set({ language }),
      logout: () => set({ user: null, isLoggedIn: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
