// English / தமிழ் for the coordinator screens. Teachings, quotations and anything a person wrote stay as written.
import { LANGUAGES, useLanguage, useT } from '../../i18n';

export default function LanguageToggle({ className = '' }) {
  const { language, setLanguage } = useLanguage();
  const t = useT();
  return (
    <div className={`flex items-center gap-1 ${className}`} role="group" aria-label={t('Language')} data-testid="language-toggle">
      {LANGUAGES.map(([code, label]) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
          className={`min-h-9 rounded-full px-3 text-sm font-medium ${language === code ? 'bg-ink-800 text-cream-50' : 'bg-cream-50 text-ink-700 ring-1 ring-cream-300 hover:bg-cream-100'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
