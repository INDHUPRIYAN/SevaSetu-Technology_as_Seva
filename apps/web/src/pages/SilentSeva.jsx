// /my-seva/:commitmentId/silent — Silent Seva. After "I have arrived": a calm full screen, no nav,
// nothing to read or tap except "Session over", which marks this week served and opens the diary.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useLoad } from '../lib/useLoad';
import Button from '../components/ui/Button';

export default function SilentSeva() {
  const { commitmentId } = useParams();
  const navigate = useNavigate();
  const commitment = useLoad(() => api.get(`/api/commitments/${commitmentId}`), [commitmentId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function sessionOver() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/commitments/${commitmentId}/served`, { week: commitment.data.currentWeek });
      toast();
      navigate(`/reflect/${commitmentId}`, { replace: true });
    } catch (e) {
      setError(e?.message ? e : { message: 'Could not save. Try again.' });
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between bg-cream-100 px-6 pt-[max(env(safe-area-inset-top),48px)] pb-[max(env(safe-area-inset-bottom),32px)] text-center">
      <span aria-hidden="true" />
      <div className="max-w-[340px]">
        <p className="font-serif text-2xl leading-snug text-ink-900">You are with them now.</p>
        <p className="mt-3 font-serif text-2xl leading-snug text-ink-700">Put the phone away.</p>
      </div>
      <div className="w-full max-w-[340px]">
        {error && <p role="alert" className="mb-3 text-sm text-saffron-700">{error.message}</p>}
        <Button variant="outline" block disabled={busy || !commitment.data} onClick={sessionOver}>
          Session over
        </Button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-3 min-h-11 text-sm text-ink-500 hover:text-ink-800"
        >
          I have not started yet
        </button>
      </div>
    </main>
  );
}
