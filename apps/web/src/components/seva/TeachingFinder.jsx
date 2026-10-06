// Teaching Finder on the Wisdom page: she describes a situation in its own box (never the diary, never
// saved) and sees the closest verified teaching (bridge, /find-teaching). The bridge returns only an id;
// the text and source shown here are the stored, verified ones.
import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../lib/api';
import Button from '../ui/Button';

export default function TeachingFinder({ items }) {
  const [situation, setSituation] = useState('');
  const [state, setState] = useState({ status: 'idle' });

  async function find(e) {
    e.preventDefault();
    if (!situation.trim() || state.status === 'finding') return;
    setState({ status: 'finding' });
    try {
      const { id, source } = await api.post('/api/bridge/find-teaching', { situation });
      setState({ status: 'done', item: items.find(w => w.id === id) || null, source });
    } catch {
      setState({ status: 'error' });
    }
  }

  return (
    <section aria-labelledby="teaching-finder" className="rounded-2xl border border-line bg-surface p-4 @2xl:p-6">
      <h2 id="teaching-finder" className="font-serif text-lg font-semibold text-ink">Teaching Finder</h2>
      <form onSubmit={find} className="mt-2">
        <label htmlFor="situation" className="text-sm text-ink-soft">
          Describe what happened. This box is not saved, and it is separate from your diary.
        </label>
        <textarea
          id="situation"
          rows={3}
          maxLength={1000}
          value={situation}
          onChange={e => setSituation(e.target.value)}
          placeholder="I had to wait a long time today, and I got impatient."
          className="mt-2 block w-full resize-y rounded-2xl border border-line bg-white/80 px-4 py-3 text-base leading-relaxed text-ink
            placeholder:text-ink-soft/70 focus:border-saffron focus:ring-3 focus:ring-saffron/25 focus:outline-none"
        />
        <Button type="submit" variant="secondary" className="mt-3" disabled={!situation.trim() || state.status === 'finding'}>
          <Search size={16} /> {state.status === 'finding' ? 'Finding…' : 'Find a teaching'}
        </Button>
      </form>

      <div aria-live="polite">
        {state.status === 'done' && state.item && (
          <figure className="mt-4 rounded-2xl bg-peach-soft p-4" data-testid="found-teaching">
            {state.source === 'ai' && <p className="text-xs font-semibold tracking-wide text-ember uppercase">Suggested</p>}
            <blockquote className="mt-1 font-serif text-lg leading-snug text-ink italic break-words">“{state.item.text}”</blockquote>
            <figcaption className="mt-2 text-sm text-ink-soft">— Swami Vivekananda<span className="mt-0.5 block text-xs">{state.item.source}</span></figcaption>
          </figure>
        )}
        {state.status === 'done' && !state.item && (
          <p className="mt-4 text-sm text-ink-soft">No checked teaching matches this yet. Try telling it in other words.</p>
        )}
        {state.status === 'error' && <p className="mt-4 text-sm text-ember" role="alert">Could not search just now. Try again.</p>}
      </div>
    </section>
  );
}
