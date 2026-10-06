// apps/web/src/lib/auth.js — who is logged in. Kept across reloads.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuth = create(
  persist(
    set => ({
      token: null,
      user: null,
      login: ({ token, user }) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'sevasetu-auth' }
  )
);

export const homeFor = user => (user?.role === 'coordinator' ? '/coordinator' : '/');
