import { useState } from 'react';
import { ArrowRightLeft, CalendarDays, Check, MapPin, Package } from 'lucide-react';
import { api } from '../lib/api';
import { useLoad } from '../lib/useLoad';
import { longDate, shortDate } from '../lib/format';
import { EmptyState, ErrorNote, IconBadge, Loading, PageHeader, SectionTitle, StatusPill, TextArea } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const FIELD = 'h-11 w-full rounded-2xl bg-cream-50 px-4 text-[15px] ring-1 ring-cream-300 focus:outline-none focus:ring-2 focus:ring-saffron-400';
const EMPTY = { kind: 'request', type: '', quantity: '', availableFrom: '', note: '' };

// /coordinator/resources — Resource Connect: offer or ask for things; SevaSetu suggests matches
export default function Resources() {
  const mine = useLoad(() => api.get('/api/resources/mine'));
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await mine.reload({ quiet: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  const ready = form.type.trim() && Number(form.quantity) >= 1;

  return (
    <div className="lg:max-w-4xl">
      <PageHeader title="Resource Connect" subtitle="Offer or ask for things, never people." />

      <div className="space-y-6 xl:grid xl:grid-cols-[360px_1fr] xl:items-start xl:gap-8 xl:space-y-0">
        <Card className="p-5 xl:sticky xl:top-8">
          <form onSubmit={e => { e.preventDefault(); if (ready) act(async () => { await api.post('/api/resources', { ...form, quantity: Number(form.quantity) }); setForm(EMPTY); }); }}>
            <fieldset>
              <legend className="mb-2 font-semibold text-ink-900">Your organisation…</legend>
              <div className="grid grid-cols-2 gap-2">
                {[['request', 'needs'], ['offer', 'can offer']].map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={form.kind === k} onClick={() => setForm(f => ({ ...f, kind: k }))}
                    className={`h-11 rounded-full text-sm font-semibold ${form.kind === k ? 'bg-saffron-500 text-white shadow-lift' : 'bg-cream-50 text-ink-700 ring-1 ring-cream-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 grid grid-cols-[1fr_96px] gap-3">
              <label className="block text-sm font-medium text-ink-800">What
                <input className={`${FIELD} mt-1`} value={form.type} onChange={set('type')} placeholder="tablets" maxLength={60} />
              </label>
              <label className="block text-sm font-medium text-ink-800">How many
                <input className={`${FIELD} mt-1`} type="number" min={1} inputMode="numeric" value={form.quantity} onChange={set('quantity')} placeholder="10" />
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium text-ink-800">{form.kind === 'request' ? 'Needed by' : 'Ready from'}
              <input className={`${FIELD} mt-1`} type="date" value={form.availableFrom} onChange={set('availableFrom')} />
            </label>
            <div className="mt-3">
              <TextArea rows={2} maxLength={300} placeholder="Anything the other side should know (optional)" value={form.note} onChange={set('note')} aria-label="Note" />
            </div>
            <Button type="submit" block className="mt-4" disabled={busy || !ready}>Find matches</Button>
          </form>
        </Card>

        <section>
          <SectionTitle>Yours</SectionTitle>
          <ErrorNote error={error || mine.error} onRetry={mine.error ? mine.reload : undefined} />
          {mine.loading && <Loading />}
          {mine.data && (mine.data.length ? (
            <ul className="space-y-3">
              {mine.data.map(r => <li key={r._id}><ResourceCard r={r} busy={busy} act={act} /></li>)}
            </ul>
          ) : (
            <EmptyState title="Nothing yet">Say what your organisation needs or can offer, and SevaSetu will suggest a match nearby.</EmptyState>
          ))}
        </section>
      </div>
    </div>
  );
}

function ResourceCard({ r, busy, act }) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="flex items-start gap-3">
        <IconBadge icon={Package} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{r.kind === 'request' ? 'You need' : 'You offer'}</p>
          <p className="font-serif text-lg font-semibold capitalize text-ink-900">{r.quantity} {r.type}</p>
          {r.availableFrom && <p className="text-sm text-ink-500">{r.kind === 'request' ? 'Needed by' : 'Ready from'} {longDate(r.availableFrom)}</p>}
        </div>
        <StatusPill status={r.status} />
      </div>

      {r.status === 'open' && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink-900">Suggested matches</p>
          {r.candidates.length ? (
            <ul className="mt-2 space-y-2">
              {r.candidates.map(c => (
                <li key={c._id} className="rounded-2xl bg-cream-100 p-3.5">
                  <p className="font-medium text-ink-900">{c.org.name}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-700">
                    <span className="capitalize">{c.kind === 'offer' ? 'Offers' : 'Needs'} {c.quantity} {c.type}</span>
                    <span className="flex items-center gap-1"><MapPin size={13} />{c.org.city}</span>
                    {c.availableFrom && <span className="flex items-center gap-1"><CalendarDays size={13} />{shortDate(c.availableFrom)}</span>}
                  </p>
                  {c.note && <p className="mt-1 text-sm italic text-ink-500">“{c.note}”</p>}
                  <Button size="sm" className="mt-2.5" disabled={busy}
                    onClick={() => act(() => api.post(`/api/resources/${r._id}/connect`, { withId: c._id }))}>
                    <ArrowRightLeft size={15} /> Connect
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-500">No match yet. It stays open, and appears to others who offer or need the same.</p>
          )}
        </div>
      )}

      {r.status !== 'open' && r.matchedWith && (
        <p className="mt-4 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          Connected with <b>{r.matchedWith.org?.name}</b> ({r.matchedWith.quantity} {r.matchedWith.type}). Their coordinator sees this too.
        </p>
      )}
      {r.status === 'matched' && (
        <Button size="sm" variant="soft" className="mt-3" disabled={busy} onClick={() => act(() => api.post(`/api/resources/${r._id}/handover`))}>
          <Check size={15} /> Mark handed over
        </Button>
      )}
      {r.status === 'handed-over' && (
        <p className="mt-3 text-sm font-medium text-emerald-700">Handed over on {shortDate(r.handedOverAt)}.</p>
      )}
    </Card>
  );
}
