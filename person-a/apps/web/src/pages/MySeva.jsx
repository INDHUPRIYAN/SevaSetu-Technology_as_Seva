import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, ChevronRight, Ear, Flag, MapPin, Mail, Pause, Repeat } from 'lucide-react';
import { api } from '../lib/api';
import { useLoad } from '../lib/useLoad';
import { firstName, rhythm, shortDate } from '../lib/format';
import { Avatar, EmptyState, ErrorNote, Loading, PageHeader, SectionTitle, StatusPill } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WeekStrip from '../components/WeekStrip';
import { WhyLink } from '../integration/personB';

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
  const listening = (visits.data || []).filter(v => v.status !== 'agreed' || !list.some(x => x.visitId === v._id));

  const loaded = !commitments.loading && !circle.loading && !visits.loading;
  useEffect(() => {
    if (loaded && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loaded, hash]);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await Promise.all([commitments.reload({ quiet: true }), circle.reload({ quiet: true })]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <><PageHeader title="My Seva" back={false} /><Loading /></>;

  const choose = choice => act(() => api.patch(`/api/commitments/${c._id}/continue`, { choice }));

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
              Find a need, visit to listen, and when you both say yes, your weeks will show here.
            </EmptyState>
          ) : (
            <>
              {c.invitation && <div className="xl:hidden"><Invitation c={c} busy={busy} onChoose={choose} /></div>}
              <CommitmentCard c={c} busy={busy} act={act} />
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

function CommitmentCard({ c, busy, act }) {
  const current = c.sessions.find(s => s.week === c.currentWeek);
  return (
    <Card className="p-5 lg:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-[22px] font-semibold leading-snug text-ink-900 lg:text-[28px]">{c.need.title}</h2>
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

      {c.sentence && (
        <p className="mt-5 border-l-2 border-saffron-300 pl-3 font-serif italic leading-relaxed text-ink-700 lg:text-lg">“{c.sentence}”</p>
      )}

      {c.status === 'active' && current?.status === 'upcoming' && (
        <Button variant="soft" block className="mt-5 lg:w-auto" disabled={busy}
          onClick={() => act(() => api.post(`/api/commitments/${c._id}/absence`, { week: c.currentWeek }))}>
          I cannot come this week
        </Button>
      )}
      {current?.status === 'gap' && (
        <p className="mt-5 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          You told your circle you cannot come this week. Someone can cover for you.
        </p>
      )}
    </Card>
  );
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
              <Button size="sm" className="mt-3" disabled={busy}
                onClick={() => act(() => api.post(`/api/commitments/${g.commitmentId}/cover`, { week: g.week }))}>
                I will cover
              </Button>
            </div>
          ))}
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
    <Card className="animate-rise overflow-hidden bg-gradient-to-br from-saffron-50 to-cream-50 p-5 ring-saffron-200 lg:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-saffron-600"><Mail size={16} /> An invitation from the community</p>
      <p className="mt-3 font-serif text-xl italic leading-snug text-ink-900">“{c.invitation.text}”</p>
      <p className="mt-2 text-xs text-ink-500">Sent {shortDate(c.invitation.sentAt)}</p>
      <div className="mt-5 space-y-2">
        <Button block disabled={busy} onClick={() => onChoose('continue')}><Repeat size={18} /> Continue for 4 more weeks</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onChoose('pause')}><Pause size={16} /> Pause</Button>
          <Button variant="outline" disabled={busy} onClick={() => onChoose('finish')}><Flag size={16} /> Finish</Button>
        </div>
      </div>
    </Card>
  );
}
