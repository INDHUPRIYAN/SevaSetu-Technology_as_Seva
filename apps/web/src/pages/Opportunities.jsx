import { useSearchParams } from 'react-router-dom';
import { BadgeCheck, CalendarDays, ChevronRight, MapPin, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { rhythm } from '../lib/format';
import { Chip, EmptyState, ErrorNote, Loading, PageHeader } from '../components/ui/Bits';
import Card from '../components/ui/Card';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DISTANCES = [3, 5, 10, 25];
const INTERESTS = ['teaching', 'reading', 'conversation', 'listening', 'art', 'gardening', 'games'];

// the answers live in the URL, so Back from a need returns to the same results
export default function Opportunities() {
  const user = useAuth(s => s.user);
  const [params, setParams] = useSearchParams();
  const day = params.get('day') || 'Saturday';
  const maxKm = Number(params.get('maxKm') || 5);
  const interest = params.get('interest') || user?.interests?.find(i => INTERESTS.includes(i)) || 'teaching';

  const set = (key, value) => setParams(p => { p.set(key, value); return p; }, { replace: true });

  const needs = useLoad(
    () => api.get('/api/needs', { params: { day, maxKm, interest } }),
    [day, maxKm, interest]
  );

  return (
    <div>
      <PageHeader title="Find a Need" subtitle="Three questions. At most three answers." back={false} />

      <div className="xl:grid xl:grid-cols-[360px_1fr] xl:items-start xl:gap-10">
      <div className="space-y-5 xl:sticky xl:top-8 lg:rounded-3xl lg:bg-cream-50 lg:p-6 lg:shadow-card lg:ring-1 lg:ring-cream-300/70">
        <Question n={1} title="Which day can you give?">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            {DAYS.map(d => <Chip key={d} active={d === day} onClick={() => set('day', d)}>{d.slice(0, 3)}</Chip>)}
          </div>
        </Question>

        <Question n={2} title="How far can you travel?">
          <div className="flex flex-wrap gap-2">
            {DISTANCES.map(k => <Chip key={k} active={k === maxKm} onClick={() => set('maxKm', k)}>{k} km</Chip>)}
          </div>
        </Question>

        <Question n={3} title="What do you enjoy?">
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(i => (
              <Chip key={i} active={i === interest} onClick={() => set('interest', i)}>
                <span className="capitalize">{i}</span>
              </Chip>
            ))}
          </div>
        </Question>
      </div>

      <section className="mt-8 xl:mt-0" aria-live="polite">
        <h2 className="mb-3 font-serif text-[22px] font-semibold text-ink-900">Needs that fit you</h2>
        <ErrorNote error={needs.error} onRetry={needs.reload} />
        {needs.loading && <Loading label="Looking nearby" />}
        {!needs.loading && !needs.error && (needs.data?.length ? (
          <ul className="space-y-3">
            {needs.data.map(n => <li key={n._id} className="animate-rise"><NeedCard n={n} /></li>)}
          </ul>
        ) : (
          <EmptyState title="Nothing fits these answers yet">
            Try a longer distance or another day. We only show a few needs, so each one gets your full attention.
          </EmptyState>
        ))}
      </section>
      </div>
    </div>
  );
}

function Question({ n, title, children }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 flex items-center gap-2 font-semibold text-ink-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-saffron-100 text-xs font-bold text-saffron-600">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function NeedCard({ n }) {
  return (
    <Card to={`/needs/${n._id}`} className="p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-semibold leading-snug text-ink-900">{n.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
            {n.org.name}
            {n.verified && <BadgeCheck size={15} className="text-saffron-500" aria-label="Verified" />}
          </p>
        </div>
        <ChevronRight className="mt-1 text-saffron-500" size={20} />
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-2xl bg-saffron-50 px-3 py-2.5 text-sm leading-relaxed text-ink-800">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-saffron-500" />
        <span><span className="font-semibold">Why this fits: </span>{n.fitReason}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-700">
        <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-ink-500" />{rhythm(n.rhythm)}</span>
        <span className="flex items-center gap-1.5"><MapPin size={14} className="text-ink-500" />{n.org.distanceKm} km</span>
      </div>
    </Card>
  );
}
