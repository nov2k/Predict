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
  isRealMode: boolean;
  setUser: (user: User | null) => void;
  setHasDoneFakeBet: (val: boolean) => void;
  setLanguage: (lang: 'en' | 'ru') => void;
  setIsRealMode: (val: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      hasDoneFakeBet: false,
      language: 'en',
      isRealMode: false,
      setUser: (user) => set({ user, isLoggedIn: !!user }),
      setHasDoneFakeBet: (val) => set({ hasDoneFakeBet: val }),
      setLanguage: (language) => set({ language }),
      setIsRealMode: (isRealMode) => set({ isRealMode }),
      logout: () => set({ user: null, isLoggedIn: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
