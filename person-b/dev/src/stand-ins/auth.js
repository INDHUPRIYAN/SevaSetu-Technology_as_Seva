// STAND-IN for Person A's apps/web/src/lib/auth.js. B's pages only read `token` and
// `user` ({ _id, name, role }); see person-b/docs/HANDOVER.md.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuth = create(persist(
  set => ({
    token: null,
    user: null,
    login: (token, user) => set({ token, user }),
    logout: () => set({ token: null, user: null }),
  }),
  { name: 'seva-auth' },
));
