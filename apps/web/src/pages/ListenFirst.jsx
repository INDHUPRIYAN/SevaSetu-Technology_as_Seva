import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CameraOff, Check, Clock, Ear, Footprints, HandHeart, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useLoad } from '../lib/useLoad';
import { rhythm } from '../lib/format';
import { ErrorNote, Loading, PageHeader, TextArea } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WhyLink from '../components/seva/WhyLink';
import WisdomMoment from '../components/seva/WisdomMoment';
import ListeningGuide from '../components/seva/ListeningGuide';

const STEPS = ['Briefing', 'Request', 'Listen', 'Their answer'];

// The ramp, always in this order: the volunteer is never asked to commit before the community has spoken.
export const RAMP = ['One visit', 'Invitation', '4 weeks', 'Continue'];
export function Ramp({ at, className = '' }) {
  return (
    <ol className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs ${className}`} aria-label="How seva begins here">
      {RAMP.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5" aria-current={i === at ? 'step' : undefined}>
          <span className={`rounded-full px-2.5 py-1 font-medium ${i === at ? 'bg-saffron-500 text-white' : i < at ? 'bg-saffron-100 text-saffron-700' : 'bg-cream-100 text-ink-500'}`}>{s}</span>
          {i < RAMP.length - 1 && <span aria-hidden="true" className="text-ink-400">→</span>}
        </li>
      ))}
    </ol>
  );
}

const RULES = [
  { icon: Footprints, text: 'Go as a guest. The community is the host.' },
  { icon: Ear, text: 'Listen more than you speak. Ask, then wait.' },
  { icon: CameraOff, text: 'No photos of the people you meet.', why: 'no-photos' },
  { icon: Clock, text: 'Keep to the time you were given.' },
  { icon: HandHeart, text: 'Promise nothing you cannot keep.' },
];

export default function ListenFirst() {
  const { id } = useParams();
  const need = useLoad(() => api.get(`/api/needs/${id}`), [id]);
  const visits = useLoad(() => api.get('/api/visits/mine'), [id]);
  const [briefed, setBriefed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const visit = visits.data?.find(v => v.needId === id);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast();
      await visits.reload({ quiet: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (need.loading || visits.loading) return <><PageHeader title="Listen First" /><Loading /></>;
  if (need.error) return <><PageHeader title="Listen First" /><ErrorNote error={need.error} onRetry={need.reload} /></>;

  const n = need.data;
  const step = !visit ? (briefed ? 1 : 0)
    : visit.status === 'requested' ? 2
    : 3;

  return (
    <div className="lg:max-w-2xl">
      <PageHeader title="Listen First" subtitle={n.title} />
      <Ramp at={visit?.status === 'invited' ? 1 : 0} className="mb-3" />
      <Stepper step={step} />
      <ErrorNote error={error} />

      <div className="mt-4 animate-rise" key={step}>
        {step === 0 && (
          <Card className="p-4">
            <h2 className="font-serif text-xl font-semibold text-ink-900">Before you go</h2>
            <p className="mt-1 text-sm text-ink-500">A short briefing from {n.org.name}.</p>
            <ul className="mt-4 space-y-3">
              {RULES.map(r => (
                <li key={r.text} className="flex items-start gap-3 text-[15px] text-ink-800">
                  <r.icon size={20} className="mt-0.5 shrink-0 text-saffron-500" />
                  <span>{r.text} {r.why && <WhyLink rule={r.why} />}</span>
                </li>
              ))}
            </ul>
            <ListeningGuide need={n} className="mt-5" />
            <Button block className="mt-6" onClick={() => setBriefed(true)}>I understand</Button>
          </Card>
        )}
        {step === 0 && <WisdomMoment moment="before-listen" className="mt-4" />}

        {step === 1 && (
          <Card className="p-4">
            <h2 className="font-serif text-xl font-semibold text-ink-900">Ask to visit</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-700">
              You will visit once, only to listen. Nobody is asked to commit to anything. Afterwards the next word is the community's: they may invite you back, or not.
            </p>
            <p className="mt-3 rounded-2xl bg-saffron-50 px-4 py-3 text-sm text-ink-800">
              {rhythm(n.rhythm)} · {n.place}
            </p>
            <Button block className="mt-6" disabled={busy} onClick={() => act(() => api.post(`/api/needs/${id}/visits`))}>
              Request a visit
            </Button>
          </Card>
        )}

        {step === 2 && <HeardStep busy={busy} n={n} onSave={text => act(() => api.patch(`/api/visits/${visit._id}/heard`, { text }))} />}

        {step === 3 && <TheirAnswer visit={visit} busy={busy} onRefresh={() => act(async () => {})} />}
      </div>
    </div>
  );
}

function Stepper({ step }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1.5" aria-current={i === step ? 'step' : undefined}>
          <span className={`h-1.5 rounded-full ${i <= step ? 'bg-saffron-500' : 'bg-cream-300'}`} />
          <span className={`text-xs font-medium ${i === step ? 'text-saffron-600' : 'text-ink-500'}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function HeardStep({ n, busy, onSave }) {
  const [text, setText] = useState('');
  return (
    <Card className="p-4">
      <p className="mb-4 rounded-2xl bg-saffron-50 px-4 py-3 text-sm text-ink-800">
        Your visit is requested. Go {rhythm(n.rhythm).replace('Every ', 'on ')} at {n.place}, and come back here afterwards.
      </p>
      <TextArea
        label="What did you hear that you did not expect?"
        hint="Write it in your own words. The community sees this."
        placeholder="I thought they wanted… but they told me…"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <Button block className="mt-4" disabled={busy || !text.trim()} onClick={() => onSave(text)}>
        Save what I heard
      </Button>
    </Card>
  );
}

// After the visit the volunteer is asked nothing. The community invites, or not.
function TheirAnswer({ visit, busy, onRefresh }) {
  if (visit.status === 'invited') {
    return (
      <Card className="p-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-saffron-100 text-saffron-600"><Check size={28} /></span>
        <h2 className="mt-3 font-serif text-xl font-semibold text-ink-900">They would like you to come back</h2>
        <blockquote className="mt-3 rounded-2xl bg-saffron-50 px-4 py-3 font-serif italic text-ink-800">“{visit.invitation?.text}”</blockquote>
        <p className="mt-3 text-sm text-ink-500">The community's words, relayed by their coordinator. Now it is yours to answer.</p>
        <Button to={`/commit/${visit._id}`} block className="mt-5">Commit</Button>
      </Card>
    );
  }
  // the community said no: the "declined" moment, a calm full screen with one next action
  if (visit.status === 'declined') return <Navigate to="/moments/declined" replace />;

  return (
    <Card className="space-y-5 p-4">
      <blockquote className="rounded-2xl bg-saffron-50 px-4 py-3 font-serif italic text-ink-800">
        “{visit.heardText}”
      </blockquote>
      <div>
        <h2 className="font-serif text-xl font-semibold text-ink-900">The next word is theirs</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-700">
          You have visited and listened. Nothing more is asked of you. If the community would like you to come back, their coordinator will say so here.
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-cream-100 px-4 py-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-saffron-400" />
        <p className="flex-1 text-sm text-ink-800">Waiting for the community’s answer</p>
        <button onClick={onRefresh} disabled={busy} aria-label="Check again" className="rounded-full p-1.5 text-saffron-600 hover:bg-saffron-50">
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>
    </Card>
  );
}
