// A small "Saved" toast after every save: toast('Saved'). One at a time; it hides itself.
import { create } from 'zustand';

export const useToast = create(set => ({
  message: null,
  show: message => {
    set({ message });
    clearTimeout(useToast.timer);
    useToast.timer = setTimeout(() => set({ message: null }), 2200);
  },
}));

export const toast = (message = 'Saved') => useToast.getState().show(message);
