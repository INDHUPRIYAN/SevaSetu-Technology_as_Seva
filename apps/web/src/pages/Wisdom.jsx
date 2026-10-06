// /wisdom — Swamiji's teachings with their source (endpoint 26). Theme chips filter the list.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/seva/PageHeader';
import { WisdomBook } from '../components/seva/icons';

export const THEMES = [
  { key: '', label: 'All' },
  { key: 'service', label: 'Service' },
  { key: 'strength', label: 'Strength' },
  { key: 'patience', label: 'Patience' },
  { key: 'work', label: 'Work' },
];

const labelOf = key => THEMES.find(t => t.key === key)?.label || key;

export default function Wisdom() {
  const [theme, setTheme] = useState('');
  const [state, setState] = useState({ status: 'loading', items: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, status: 'loading' }));
    api.get('/api/wisdom', { params: theme ? { theme } : {} })
      .then(items => alive && setState({ status: 'ready', items: Array.isArray(items) ? items : [] }))
      .catch(() => alive && setState({ status: 'error', items: [] }));
    return () => { alive = false; };
  }, [theme, attempt]);

  return (
    <div className="@container mx-auto w-full max-w-5xl pt-6 pb-10 lg:mx-0 lg:pt-0">
      <PageHeader eyebrow="Seva Wisdom" title="Wisdom" subtitle="Swami Vivekananda's words, with where to find them in the Complete Works." />

      <div role="group" aria-label="Filter by theme" className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 @2xl:mx-0 @2xl:flex-wrap @2xl:px-0">
        {THEMES.map(t => {
          const active = t.key === theme;
          return (
            <button
              key={t.key || 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(t.key)}
              className={`min-h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition-colors ${active
                ? 'border-saffron-strong bg-saffron-strong text-white shadow-pill'
                : 'border-line bg-surface text-ink hover:bg-peach-soft'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" aria-busy={state.status === 'loading'} className="mt-5">
        {state.status === 'error' && (
          <Card className="p-5" role="alert">
            <p className="text-base text-ink">The teachings could not be opened just now.</p>
            <Button variant="secondary" className="mt-4" onClick={() => setAttempt(n => n + 1)}>Try again</Button>
          </Card>
        )}

        {state.status === 'loading' && state.items.length === 0 && (
          <div className="grid gap-4 @2xl:grid-cols-2">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-40 animate-pulse rounded-3xl bg-peach-soft" />)}
          </div>
        )}

        {state.status !== 'error' && state.items.length > 0 && (
          <ul className={`grid gap-4 @2xl:grid-cols-2 ${state.status === 'loading' ? 'opacity-60' : ''}`}>
            {state.items.map(w => (
              <li key={w._id}>
                <Card className="flex h-full flex-col p-5 @2xl:p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-peach text-saffron">
                      <WisdomBook className="size-5" />
                    </span>
                    <span className="rounded-full bg-peach-soft px-3 py-1 text-xs font-semibold text-ember">{labelOf(w.theme)}</span>
                  </div>
                  <blockquote className="mt-3 flex-1 font-serif text-lg leading-snug text-ink italic break-words @2xl:text-xl">
                    “{w.text}”
                  </blockquote>
                  <p className="mt-3 text-sm text-ink-soft">
                    — Swami Vivekananda<span className="mt-0.5 block text-xs">{w.source}</span>
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {state.status === 'ready' && state.items.length === 0 && (
          <Card className="p-5"><p className="text-base text-ink-soft">No teachings for this theme yet.</p></Card>
        )}
      </div>
    </div>
  );
}
