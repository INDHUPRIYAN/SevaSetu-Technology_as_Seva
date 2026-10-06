import { useState } from 'react';
import { Check, CirclePlus, FastForward, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { firstName, rhythm, shortDate } from '../lib/format';
import { TopBar } from '../components/ui/Brand';
import { HeroScene } from '../components/ui/Art';
import { EmptyState, ErrorNote, Loading, SectionTitle, StatusPill, TextArea } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WeekStrip from '../components/WeekStrip';

export default function Coordinator() {
  const user = useAuth(s => s.user);
  const overview = useLoad(() => api.get('/api/coordinator/overview'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await overview.reload({ quiet: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const o = overview.data;

  return (
    <div className="space-y-6">
      <div className="relative -mx-4 overflow-hidden bg-gradient-to-b from-[#F6A65A] via-[#F9C88F] to-cream-100 px-4 pb-6 lg:mx-0 lg:rounded-[2rem] lg:bg-gradient-to-r lg:from-[#F6A65A] lg:via-[#F8BC7C] lg:to-[#FBD9AE] lg:px-12 lg:pb-12 lg:pt-8">
        <HeroScene className="pointer-events-none absolute bottom-0 right-0 hidden h-[calc(100%-5.5rem)] w-[55%] lg:block lg:[mask-image:linear-gradient(to_right,transparent,black_40%)]" />
        <div className="relative">
          <TopBar />
          <h1 className="mt-6 font-serif text-[28px] font-semibold leading-tight text-ink-900 lg:mt-10 lg:text-5xl">
            Vanakkam, {firstName(user?.name)}
          </h1>
          <p className="mt-1 text-[15px] text-ink-800 lg:mt-3 lg:max-w-md lg:text-lg">Who is listening, who is serving, and how each week went.</p>
          <Button to="/coordinator/post-need" className="mt-4 lg:mt-6"><CirclePlus size={18} /> Post a Need</Button>
        </div>
      </div>

      <ErrorNote error={error || overview.error} onRetry={overview.error ? overview.reload : undefined} />
      {overview.loading && <Loading />}

      {o && (
        <div className="space-y-6 xl:grid xl:grid-cols-[1fr_360px] xl:items-start xl:gap-8 xl:space-y-0">
          <div className="space-y-6">
          <section>
            <SectionTitle>Visits waiting for you</SectionTitle>
            {o.pendingVisits.length ? (
              <ul className="space-y-3">
                {o.pendingVisits.map(v => <li key={v._id}><PendingVisit v={v} busy={busy} act={act} /></li>)}
              </ul>
            ) : (
              <p className="rounded-2xl bg-cream-50 px-4 py-3 text-sm text-ink-500 ring-1 ring-cream-300/70">No visits waiting.</p>
            )}
          </section>

          <section>
            <SectionTitle>Volunteers serving</SectionTitle>
            {o.commitments.length ? (
              <ul className="space-y-3">
                {o.commitments.map(c => <li key={c._id}><CommitmentCard c={c} busy={busy} act={act} /></li>)}
              </ul>
            ) : (
              <EmptyState title="Nobody serving yet">When a volunteer commits, their weeks will show here.</EmptyState>
            )}
          </section>
          </div>

          <section className="xl:sticky xl:top-8">
            <SectionTitle>Your needs</SectionTitle>
            <Card className="divide-y divide-cream-200">
              {o.needs.map(n => (
                <div key={n._id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-900">{n.title}</span>
                    <span className="block truncate text-xs text-ink-500">{rhythm(n.rhythm)} · {n.orgName}</span>
                  </span>
                  <StatusPill status={n.status} />
                </div>
              ))}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}

function PendingVisit({ v, busy, act }) {
  const decide = yes => act(() => api.patch(`/api/visits/${v._id}/decision`, { yes }));
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink-900">{v.volunteerName}</p>
          <p className="text-sm text-ink-500">{v.needTitle}</p>
        </div>
        <StatusPill status={v.status} />
      </div>

      {v.status === 'requested' && (
        <p className="mt-3 text-sm text-ink-700">Asked to visit. Once they have visited and written what they heard, you can answer.</p>
      )}

      {v.status === 'visited' && (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-500">What they heard</p>
          <blockquote className="mt-1 rounded-2xl bg-saffron-50 px-4 py-3 font-serif italic text-ink-800">“{v.heardText}”</blockquote>
          <p className="mt-3 text-sm text-ink-700">
            {v.volunteerYes === null ? 'They have not answered yet.' : v.volunteerYes ? `${firstName(v.volunteerName)} would like to serve.` : `${firstName(v.volunteerName)} said no.`}
          </p>
          {v.coordinatorYes === null ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => decide(false)}><X size={16} /> Not now</Button>
              <Button size="sm" disabled={busy} onClick={() => decide(true)}><Check size={16} /> Yes, welcome</Button>
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-ink-800">You said {v.coordinatorYes ? 'yes' : 'no'}. Waiting for the volunteer.</p>
          )}
        </>
      )}
    </Card>
  );
}

function CommitmentCard({ c, busy, act }) {
  const [text, setText] = useState('');
  const [week, setWeek] = useState(c.currentWeek);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink-900">{c.volunteerName}</p>
          <p className="text-sm text-ink-500">{c.need.title}</p>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold text-saffron-600">Week {c.currentWeek} of {c.weeks}</span>
      </div>

      <WeekStrip sessions={c.sessions} currentWeek={c.currentWeek} className="mt-3" />

      {c.status !== 'active' ? (
        <p className="mt-4 text-sm text-ink-700">They chose to <b>{c.lastChoice}</b>. <StatusPill status={c.status} /></p>
      ) : c.invitation ? (
        <p className="mt-4 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          Invitation sent {shortDate(c.invitation.sentAt)}: <span className="font-serif italic">“{c.invitation.text}”</span>
        </p>
      ) : (
        <div className="mt-4">
          <TextArea
            rows={2}
            aria-label="Invitation to continue"
            placeholder="The children asked if you are coming next month."
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <Button size="sm" className="mt-2" disabled={busy || !text.trim()}
            onClick={() => act(async () => { await api.post(`/api/commitments/${c._id}/invitation`, { text }); setText(''); })}>
            <Send size={15} /> Send invitation
          </Button>
        </div>
      )}

      {/* demo control: move the commitment forward in time */}
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-cream-300 px-3 py-2.5">
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-ink-500">Demo: time travel</span>
        <label className="sr-only" htmlFor={`week-${c._id}`}>Week</label>
        <select
          id={`week-${c._id}`}
          value={week}
          onChange={e => setWeek(Number(e.target.value))}
          className="h-9 rounded-full bg-cream-50 px-3 text-sm ring-1 ring-cream-300"
        >
          {c.sessions.map(s => <option key={s.week} value={s.week}>Week {s.week}</option>)}
        </select>
        <Button size="sm" variant="soft" disabled={busy || week === c.currentWeek}
          onClick={() => act(() => api.post('/api/demo/advance', { commitmentId: c._id, toWeek: week }))}>
          <FastForward size={15} /> Go
        </Button>
      </div>
    </Card>
  );
}
