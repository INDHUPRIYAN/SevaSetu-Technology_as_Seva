import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CameraOff, Check, Clock, Ear, Footprints, HandHeart, RefreshCw, X } from 'lucide-react';
import { api } from '../lib/api';
import { useLoad } from '../lib/useLoad';
import { rhythm } from '../lib/format';
import { ErrorNote, Loading, PageHeader, TextArea } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WhyLink from '../components/seva/WhyLink';
import WisdomMoment from '../components/seva/WisdomMoment';

const STEPS = ['Briefing', 'Request', 'Listen', 'Decide'];

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
      <Stepper step={step} />
      <ErrorNote error={error} />

      <div className="mt-4 animate-rise" key={step}>
        {step === 0 && (
          <Card className="p-5">
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
            <Button block className="mt-6" onClick={() => setBriefed(true)}>I understand</Button>
          </Card>
        )}
        {step === 0 && <WisdomMoment moment="before-listen" className="mt-4" />}

        {step === 1 && (
          <Card className="p-5">
            <h2 className="font-serif text-xl font-semibold text-ink-900">Ask to visit</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-700">
              You will visit once, only to listen. Nobody commits to anything yet.
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

        {step === 3 && (
          <DecideStep
            visit={visit}
            busy={busy}
            onDecide={yes => act(() => api.patch(`/api/visits/${visit._id}/decision`, { yes }))}
            onRefresh={() => act(async () => {})}
          />
        )}
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
    <Card className="p-5">
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

function DecideStep({ visit, busy, onDecide, onRefresh }) {
  if (visit.status === 'agreed') {
    return (
      <Card className="p-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-saffron-100 text-saffron-600"><Check size={28} /></span>
        <h2 className="mt-3 font-serif text-xl font-semibold text-ink-900">You both said yes</h2>
        <p className="mt-1 text-[15px] text-ink-700">The community would like you to serve with them.</p>
        <Button to={`/commit/${visit._id}`} block className="mt-5">Commit</Button>
      </Card>
    );
  }
  if (visit.status === 'declined') {
    return (
      <Card className="p-5 text-center">
        <h2 className="font-serif text-xl font-semibold text-ink-900">Not this time</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-700">
          That is part of listening. Thank you for going. Another need may fit you better.
        </p>
        <Button to="/opportunities" variant="soft" block className="mt-5">Find another need</Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-5">
      <blockquote className="rounded-2xl bg-saffron-50 px-4 py-3 font-serif italic text-ink-800">
        “{visit.heardText}”
      </blockquote>

      <div>
        <h2 className="font-serif text-xl font-semibold text-ink-900">Would you like to serve here?</h2>
        {visit.volunteerYes === null ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" disabled={busy} onClick={() => onDecide(false)}><X size={18} /> No</Button>
            <Button disabled={busy} onClick={() => onDecide(true)}><Check size={18} /> Yes</Button>
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-ink-700">You said <b>{visit.volunteerYes ? 'yes' : 'no'}</b>.</p>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-cream-100 px-4 py-3">
        <span className={`h-2.5 w-2.5 rounded-full ${visit.coordinatorYes ? 'bg-emerald-500' : 'animate-pulse bg-saffron-400'}`} />
        <p className="flex-1 text-sm text-ink-800">
          {visit.coordinatorYes ? 'The community said yes.' : 'Waiting for the community’s answer'}
        </p>
        {!visit.coordinatorYes && (
          <button onClick={onRefresh} disabled={busy} aria-label="Check again" className="rounded-full p-1.5 text-saffron-600 hover:bg-saffron-50">
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
          </button>
        )}
      </div>
    </Card>
  );
}
