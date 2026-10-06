// A small i18n for the coordinator screens only. The English string is the key, so the code stays
// readable: t('Post a Need'). A missing translation falls back to the English. Teachings, quotations,
// need cards and anything a person wrote are never translated: they are shown as written.
// The choice is kept per browser; it is a convenience, not state.
import { create } from 'zustand';
import en from './en';
import ta from './ta';

const STRINGS = { en, ta };
export const LANGUAGES = [['en', 'English'], ['ta', 'தமிழ்']];

const read = () => { try { return localStorage.getItem('ui-language') === 'ta' ? 'ta' : 'en'; } catch { return 'en'; } };
const write = l => { try { localStorage.setItem('ui-language', l); } catch { /* fine */ } };

export const useLanguage = create(set => ({
  language: read(),
  setLanguage: language => { write(language); set({ language }); },
}));

// {name} placeholders are filled from vars: t('Relay to {name}', { name })
export function translate(language, key, vars) {
  let s = (STRINGS[language] && STRINGS[language][key]) || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useT() {
  const language = useLanguage(s => s.language);
  return (key, vars) => translate(language, key, vars);
}
