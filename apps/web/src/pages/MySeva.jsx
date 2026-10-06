import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, ChevronRight, Ear, Flag, Footprints, Handshake, HeartHandshake, MapPin, Mail, Pause, Repeat } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useLoad } from '../lib/useLoad';
import { firstName, longDate, rhythm, shortDate, tomorrowISO } from '../lib/format';
import { Avatar, EmptyState, ErrorNote, Loading, PageHeader, SectionTitle, StatusPill, TextArea } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WeekStrip from '../components/WeekStrip';
import WhyLink from '../components/seva/WhyLink';
import WisdomMoment from '../components/seva/WisdomMoment';
import { seenMoment } from '../lib/seenMoments';

// Phone and small laptops: one column. Wide screens (xl): the commitment and its weeks on the left; the invitation,
// diary, circle and visits on the right. The invitation and diary are placed in both
// columns and shown in only one, so the phone order stays: invitation, commitment, diary.
export default function MySeva() {
  const { hash } = useLocation();
  const commitments = useLoad(() => api.get('/api/commitments/mine'));
  const circle = useLoad(() => api.get('/api/circles/mine'));
  const visits = useLoad(() => api.get('/api/visits/mine'));
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const list = commitments.data || [];
  const c = list.find(x => x._id === selected) || list.find(x => x.status === 'active') || list[0];
  const listening = (visits.data || []).filter(v => v.status !== 'invited' || !list.some(x => x.visitId === v._id));

  const loaded = !commitments.loading && !circle.loading && !visits.loading;
  useEffect(() => {
    if (loaded && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loaded, hash]);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast();
      await Promise.all([commitments.reload({ quiet: true }), circle.reload({ quiet: true })]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <><PageHeader title="My Seva" back={false} /><Loading /></>;

  // a need that ended mid-commitment: show the "closed" moment once, then this page as usual
  const closed = list.find(x => x.lastChoice === 'need-closed' && !seenMoment(`closed-${x._id}`));
  if (closed) return <Navigate to={`/moments/closed/${closed._id}`} replace />;

  const choose = (choice, extra = {}) => act(() => api.patch(`/api/commitments/${c._id}/continue`, { choice, ...extra }));

  return (
    <div className="space-y-6">
      <PageHeader title="My Seva" back={false} />
      <ErrorNote error={error || commitments.error} />

      {list.length > 1 && (
        <div className="-mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:px-0">
          {list.map(x => (
            <button
              key={x._id}
              onClick={() => setSelected(x._id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${x._id === c._id ? 'bg-ink-800 text-cream-50' : 'bg-cream-50 text-ink-700 ring-1 ring-cream-300'}`}
            >
              {x.need.title}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6 xl:grid xl:grid-cols-[1fr_380px] xl:items-start xl:gap-8 xl:space-y-0">
        <div className="space-y-6">
          {!c ? (
            <EmptyState title="No seva yet" action={<Button to="/opportunities" size="sm">Find a need</Button>}>
              Find a need and visit once to listen. If the community invites you back, your weeks will show here.
            </EmptyState>
          ) : (
            <>
              {c.invitation && <div className="xl:hidden"><Invitation c={c} busy={busy} onChoose={choose} /></div>}
              <CommitmentCard c={c} busy={busy} act={act} onChoose={choose} />
              <div className="xl:hidden"><DiaryLink c={c} /></div>
              <Weeks c={c} />
            </>
          )}
        </div>

        <div className="space-y-6">
          {c?.invitation && <div className="hidden xl:block"><Invitation c={c} busy={busy} onChoose={choose} /></div>}
          {c && <div className="hidden xl:block"><DiaryLink c={c} /></div>}
          <Circle circle={circle.data} busy={busy} act={act} />
          {listening.length > 0 && <Listening visits={listening} />}
        </div>
      </div>
    </div>
  );
}

function CommitmentCard({ c, busy, act, onChoose }) {
  const current = c.sessions.find(s => s.week === c.currentWeek);
  return (
    <Card className="p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-[24px] font-semibold leading-snug text-ink-900 lg:text-[24px]">{c.need.title}</h2>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-700 lg:text-[15px]"><MapPin size={15} className="mt-0.5 shrink-0 text-ink-500" />{c.need.place}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-700 lg:text-[15px]"><CalendarDays size={15} className="text-ink-500" />{rhythm(c.need.rhythm)}</p>
        </div>
        {c.status !== 'active' && <StatusPill status={c.status} />}
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <p className="font-serif text-3xl font-semibold text-saffron-600 lg:text-4xl">
          Week {c.currentWeek} <span className="text-lg text-ink-500 lg:text-xl">of {c.weeks}</span>
        </p>
        <WhyLink rule="no-hours" />
      </div>
      <WeekStrip sessions={c.sessions} currentWeek={c.currentWeek} className="mt-3" />
      <FourSteps c={c} />

      {c.sentence && (
        <p className="mt-5 border-l-2 border-saffron-300 pl-3 font-serif italic leading-relaxed text-ink-700 lg:text-lg">“{c.sentence}”</p>
      )}

      {c.status === 'active' && current?.status === 'upcoming' && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button to={`/my-seva/${c._id}/silent`} block><Footprints size={18} /> I have arrived</Button>
          <Button variant="outline" block disabled={busy}
            onClick={() => act(() => api.post(`/api/commitments/${c._id}/absence`, { week: c.currentWeek }))}>
            I cannot come this week
          </Button>
        </div>
      )}
      {c.status === 'active' && current?.status === 'served' && (
        <p className="mt-5 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">This week is served. Thank you.</p>
      )}
      {current?.status === 'gap' && <AbsenceNote c={c} week={current} busy={busy} act={act} />}
      {c.status === 'paused' && (
        <p className="mt-5 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          Paused. You plan to come back on <b>{longDate(c.pausedUntil)}</b>.
        </p>
      )}
      {c.status === 'finished' && c.lastChoice === 'community-ended' && (
        <p className="mt-5 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          At their check-in, the community chose to end this arrangement. Thank you for every week you kept.
        </p>
      )}
      {c.status === 'finished' && c.lastChoice === 'need-closed' && (
        <p className="mt-5 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          This seva is complete: the need has ended. Thank you for every week you kept.
          {' '}<Link to={`/moments/closed/${c._id}`} className="font-medium text-saffron-700 underline">Read the note</Link>
        </p>
      )}
      {c.status === 'finished' && !['community-ended', 'need-closed'].includes(c.lastChoice) && (
        <p className="mt-5 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          Finished. Thank you for every week you kept. Your handover note is with your circle and the next volunteer.
        </p>
      )}
      {c.status === 'finished' && c.communityWords && (
        <figure className="mt-3 rounded-2xl bg-saffron-50 px-4 py-3" data-testid="community-words">
          <figcaption className="text-xs font-semibold uppercase tracking-wider text-saffron-700">The community's words</figcaption>
          <blockquote lang={c.communityWords.language} className="mt-1 font-serif text-[17px] italic leading-snug text-ink-900">“{c.communityWords.text}”</blockquote>
          <p className="mt-1 text-xs text-ink-500">Relayed by their coordinator, as it was said.</p>
        </figure>
      )}
      {c.status === 'active' && !c.invitation && (
        <details className="mt-5 rounded-2xl ring-1 ring-cream-300 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-700">Need to step away?</summary>
          <div className="px-4 pb-4"><StepAway c={c} busy={busy} onChoose={onChoose} /></div>
        </details>
      )}
    </Card>
  );
}

// After "I cannot come this week" (one tap, no penalty): an optional note for whoever covers
function AbsenceNote({ c, week, busy, act }) {
  const [note, setNote] = useState(week.note || '');
  return (
    <div className="mt-5 rounded-2xl bg-cream-100 p-4">
      <p className="text-sm text-ink-700">Your circle knows you cannot come this week. Someone can cover for you.</p>
      <div className="mt-3">
        <TextArea
          label="A note for whoever covers (optional)"
          rows={3}
          maxLength={300}
          placeholder="Where we stopped, what the students are reading…"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>
      <Button size="sm" variant="outline" className="mt-3" disabled={busy || !note.trim() || note.trim() === week.note}
        onClick={() => act(() => api.post(`/api/commitments/${c._id}/absence`, { week: week.week, note }))}>
        Save note
      </Button>
    </div>
  );
}

// The four steps of the journey, named after the four yogas. Where she is now is marked; nothing is scored.
const STEPS = [
  { key: 'listen', label: 'Listen', yoga: 'Bhakti', icon: Ear },
  { key: 'commit', label: 'Commit', yoga: 'Raja', icon: Handshake },
  { key: 'serve', label: 'Serve', yoga: 'Karma', icon: HeartHandshake },
  { key: 'reflect', label: 'Reflect', yoga: 'Jnana', icon: BookOpen },
];

function FourSteps({ c }) {
  return (
    <ol aria-label="Your four steps" className="mt-5 grid grid-cols-4 gap-2">
      {STEPS.map(s => {
        const now = s.key === 'serve' && c.status === 'active';
        const body = (
          <>
            <s.icon size={18} className={now ? 'text-saffron-600' : 'text-ink-500'} />
            <span className="mt-1 text-[13px] font-semibold text-ink-900">{s.label}</span>
            <span className="font-serif text-[13px] italic text-ink-500">{s.yoga}</span>
          </>
        );
        const cls = `flex flex-col items-center rounded-2xl px-1 py-2 text-center ${now ? 'bg-saffron-50 ring-1 ring-saffron-200' : 'bg-cream-100'}`;
        return (
          <li key={s.key} aria-current={now ? 'step' : undefined}>
            {s.key === 'reflect'
              ? <Link to={`/reflect/${c._id}`} className={`${cls} hover:ring-1 hover:ring-saffron-200`}>{body}</Link>
              : <div className={cls}>{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export const HANDOVER = [
  ['now', 'Where the group is now', 'They are on chapter 3 of the reader…'],
  ['works', 'What works well with them', 'Reading aloud in pairs, and letting them choose the story…'],
  ['know', 'What to know before you begin', 'Arrive a few minutes early; the room opens at 10…'],
];

// Pause (with the date you plan to return) or finish. Finishing is its own full screen (the "finished"
// moment): first what they gave you, then the handover for the next volunteer.
// With an invitation, Continue sits beside them as one of three equal choices.
function StepAway({ c, busy, onChoose, withContinue = false }) {
  const [mode, setMode] = useState(null);
  const [returnDate, setReturnDate] = useState('');

  if (!mode) {
    return (
      <div className={`grid gap-2 ${withContinue ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {withContinue && (
          <Button variant="outline" className="px-2" disabled={busy} onClick={() => onChoose('continue')}><Repeat /> Continue</Button>
        )}
        <Button variant="outline" className="px-2" disabled={busy} onClick={() => setMode('pause')}><Pause /> Pause</Button>
        <Button variant="outline" className="px-2" disabled={busy} to={`/moments/finished/${c._id}`}><Flag /> Finish</Button>
      </div>
    );
  }
  {
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="mb-2 block font-semibold text-ink-900">When do you plan to come back?</span>
          <input
            type="date"
            min={tomorrowISO()}
            value={returnDate}
            onChange={e => setReturnDate(e.target.value)}
            className="h-11 w-full rounded-2xl bg-cream-50 px-4 ring-1 ring-cream-300 focus:outline-none focus:ring-2 focus:ring-saffron-400"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy || !returnDate} onClick={() => onChoose('pause', { returnDate })}>Pause until then</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Back</Button>
        </div>
      </div>
    );
  }
}

function DiaryLink({ c }) {
  return (
    <Card to={`/reflect/${c._id}`} className="flex items-center gap-3.5 p-4 lg:p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-saffron-100 text-saffron-500"><BookOpen size={22} /></span>
      <span className="flex-1">
        <span className="block font-semibold text-ink-900">Seva Diary</span>
        <span className="text-sm text-ink-500">One question this week. Only you can see it.</span>
      </span>
      <ChevronRight className="text-saffron-500" size={20} />
    </Card>
  );
}

function Weeks({ c }) {
  return (
    <section>
      <SectionTitle>Weeks</SectionTitle>
      <Card className="divide-y divide-cream-200 lg:grid lg:grid-cols-2 lg:divide-y-0">
        {c.sessions.map(s => (
          <div key={s.week} className="flex items-center justify-between px-4 py-3 lg:border-b lg:border-cream-200 lg:px-6 lg:py-4 lg:odd:border-r">
            <span className={`text-[15px] ${s.week === c.currentWeek ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
              Week {s.week}{s.week === c.currentWeek && <span className="ml-2 text-xs font-medium text-saffron-600">this week</span>}
            </span>
            <span className="flex items-center gap-2 text-sm text-ink-500">
              {s.status === 'covered' && s.coveredByName && `by ${firstName(s.coveredByName)}`}
              <StatusPill status={s.status} />
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}

function Circle({ circle, busy, act }) {
  return (
    <section id="circle" className="scroll-mt-20">
      <SectionTitle>Your Circle</SectionTitle>
      {circle ? (
        <Card className="p-4 lg:p-5">
          <p className="font-semibold text-ink-900">{circle.name}</p>
          <p className="text-sm text-ink-500">You cover for each other when someone cannot come.</p>
          <ul className="mt-3 flex flex-wrap gap-3">
            {circle.members.map(m => (
              <li key={m._id} className="flex items-center gap-2 rounded-full bg-cream-100 py-1 pl-1 pr-3 text-sm text-ink-800">
                <Avatar name={m.name} size="sm" /> {firstName(m.name)}
              </li>
            ))}
          </ul>
          {circle.openGaps.map(g => (
            <div key={`${g.commitmentId}-${g.week}`} className="mt-4 rounded-2xl bg-saffron-50 p-4 ring-1 ring-saffron-100">
              <p className="text-[15px] text-ink-800">
                <b>{firstName(g.volunteerName)}</b> cannot come in week {g.week} of {g.needTitle}.
              </p>
              <p className="mt-0.5 text-sm text-ink-500">{rhythm(g.rhythm)} · {g.place}</p>
              {g.note && (
                <p className="mt-2 text-sm text-ink-700"><span className="font-semibold">Where they stopped: </span><span className="italic">“{g.note}”</span></p>
              )}
              <Button size="sm" variant="secondary" className="mt-3" disabled={busy}
                onClick={() => act(() => api.post(`/api/commitments/${g.commitmentId}/cover`, { week: g.week }))}>
                I will cover
              </Button>
            </div>
          ))}
          {circle.handovers?.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-ink-900">Handover notes</p>
              <ul className="mt-2 space-y-2">
                {circle.handovers.map(h => (
                  <li key={h.commitmentId} className="rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
                    <span className="font-semibold">{firstName(h.volunteerName)}</span> finished {h.needTitle}:
                    <span className="mt-1 block italic">“{h.note}”</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ) : (
        <p className="text-sm text-ink-500">You are not in a circle yet.</p>
      )}
    </section>
  );
}

function Listening({ visits }) {
  return (
    <section id="listening" className="scroll-mt-20">
      <SectionTitle>Listening</SectionTitle>
      <ul className="space-y-2.5">
        {visits.map(v => (
          <li key={v._id}>
            <Card to={`/needs/${v.needId}/listen`} className="flex items-center gap-3 p-4">
              <Ear size={20} className="text-saffron-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink-900">{v.needTitle}</span>
                <StatusPill status={v.status} />
              </span>
              <ChevronRight className="text-saffron-500" size={20} />
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Invitation({ c, busy, onChoose }) {
  return (
    <Card className="overflow-hidden p-4 lg:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-saffron-600"><Mail size={16} /> An invitation from the community</p>
      <p className="mt-3 font-serif text-xl italic leading-snug text-ink-900">“{c.invitation.text}”</p>
      <p className="mt-2 text-xs text-ink-500">Sent {shortDate(c.invitation.sentAt)}</p>
      <WisdomMoment moment="continue" className="mt-4" />
      <p className="mt-4 text-[13px] text-ink-500">Continue for 4 more weeks, pause, or finish with a handover. Each is a good answer.</p>
      <div className="mt-3">
        <StepAway c={c} busy={busy} onChoose={onChoose} withContinue />
      </div>
    </Card>
  );
}
