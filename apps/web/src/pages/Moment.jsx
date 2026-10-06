// /moments/:key/:commitmentId? — the non-attachment moments. A calm full screen with no nav: a short
// teaching in our own plain words (never a quotation) and one next action. No apology, no retry.
//   declined  the community said no after the listening visit → see the next need
//   closed    the need ended mid-commitment; the volunteer chooses nothing → back to My Seva
//   finished  "What did they give you?" (private, reflect) first, then "What did you give?" (the handover)
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useLoad } from '../lib/useLoad';
import { ErrorNote, TextArea } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import { HANDOVER } from './MySeva';
import { markMomentSeen } from '../lib/seenMoments';

const KEYS = ['declined', 'closed', 'finished'];

export default function Moment() {
  const { key, commitmentId } = useParams();
  const navigate = useNavigate();
  const moment = useLoad(() => api.get(`/api/wisdom/moment/${encodeURIComponent(key)}`), [key]);
  // the community's words, if the coordinator has relayed them already (closed / finished)
  const commitment = useLoad(() => (commitmentId ? api.get(`/api/commitments/${commitmentId}`) : Promise.resolve(null)), [commitmentId]);
  const words = commitment.data?.communityWords;

  // the "closed" moment opens by itself from My Seva, once
  useEffect(() => { if (key === 'closed' && commitmentId) markMomentSeen(`closed-${commitmentId}`); }, [key, commitmentId]);

  if (!KEYS.includes(key)) {
    navigate('/', { replace: true });
    return null;
  }
  const m = moment.data;

  return (
    <main className="flex min-h-dvh flex-col items-center bg-cream-100 px-6 pt-[max(env(safe-area-inset-top),48px)] pb-[max(env(safe-area-inset-bottom),32px)]">
      <div className="w-full max-w-[420px] flex-1">
        <h1 className="font-serif text-3xl leading-snug text-ink-900">{m?.title || ''}</h1>
        {m && (
          <>
            <p className="mt-5 font-serif text-xl leading-relaxed text-ink-800">{m.interpretation}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-700">{m.practice}</p>
          </>
        )}

        {words && (
          <figure className="mt-6 rounded-2xl bg-white/70 px-4 py-3" data-testid="community-words">
            <figcaption className="text-xs font-semibold uppercase tracking-wider text-saffron-700">The community's words</figcaption>
            <blockquote lang={words.language} className="mt-1 font-serif text-lg italic leading-snug text-ink-900">“{words.text}”</blockquote>
          </figure>
        )}

        {key === 'declined' && (
          <div className="mt-10">
            <Button to="/opportunities" block>See the next need</Button>
          </div>
        )}
        {key === 'closed' && (
          <div className="mt-10">
            <Button to="/my-seva" block>Back to My Seva</Button>
          </div>
        )}
        {key === 'finished' && commitmentId && <Finish commitmentId={commitmentId} />}
      </div>
    </main>
  );
}

// First what they gave, then what you give. The order is the point.
function Finish({ commitmentId }) {
  const navigate = useNavigate();
  const [received, setReceived] = useState('');
  const [receivedSaved, setReceivedSaved] = useState(false);
  const [handover, setHandover] = useState({ now: '', works: '', know: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const handoverDone = HANDOVER.every(([k]) => handover[k].trim());

  async function saveReceived() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/reflect/received', { commitmentId, text: received });
      setReceivedSaved(true);
    } catch (e) {
      if (/already written/i.test(e?.message || '')) setReceivedSaved(true);   // written already; carry on
      else setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const note = HANDOVER.map(([k, label]) => `${label}: ${handover[k].trim()}`).join('\n');
      await api.patch(`/api/commitments/${commitmentId}/continue`, { choice: 'finish', handover: note });
      toast();
      navigate('/my-seva', { replace: true });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  if (!receivedSaved) {
    return (
      <div className="mt-8 space-y-4">
        <TextArea
          label="What did they give you?"
          hint="Only you will read this. It is kept with your Sankalpa, for Then and Now."
          placeholder="They gave me…"
          rows={4}
          maxLength={1000}
          value={received}
          onChange={e => setReceived(e.target.value)}
        />
        <ErrorNote error={error} />
        <Button block disabled={busy || !received.trim()} onClick={saveReceived}>Next</Button>
        <button type="button" onClick={() => navigate(-1)} className="block w-full min-h-11 text-sm text-ink-500 hover:text-ink-800">
          Not today
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      <p className="text-lg font-semibold text-ink-900">What did you give?</p>
      <p className="-mt-1 text-[13px] text-ink-500">This is your handover for the next volunteer. Please do not name anyone you serve.</p>
      {HANDOVER.map(([k, label, placeholder]) => (
        <TextArea key={k} label={label} rows={2} maxLength={300} placeholder={placeholder}
          value={handover[k]} onChange={e => setHandover(h => ({ ...h, [k]: e.target.value }))} />
      ))}
      <ErrorNote error={error} />
      <Button block disabled={busy || !handoverDone} onClick={finish}>Finish and hand over</Button>
    </div>
  );
}
