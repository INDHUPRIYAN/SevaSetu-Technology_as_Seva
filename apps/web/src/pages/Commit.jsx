import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Repeat } from 'lucide-react';
import { api } from '../lib/api';
import { useLoad } from '../lib/useLoad';
import { rhythm, time } from '../lib/format';
import { EmptyState, ErrorNote, Loading, PageHeader, TextArea } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WisdomMoment from '../components/seva/WisdomMoment';

const WEEKS = 4;

export default function Commit() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const visits = useLoad(() => api.get('/api/visits/mine'));
  const visit = visits.data?.find(v => v._id === visitId);
  const [sentence, setSentence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // start from the fixed rhythm; the volunteer can change the words
  useEffect(() => {
    if (visit?.rhythm?.day && !sentence) {
      const r = visit.rhythm;
      setSentence(`I will come every ${r.day}${r.start ? ` from ${time(r.start)}` : ''}${r.end ? ` to ${time(r.end)}` : ''} for ${WEEKS} weeks.`);
    }
  }, [visit]); // eslint-disable-line react-hooks/exhaustive-deps

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/commitments', { visitId, weeks: WEEKS, sentence });
      navigate('/my-seva', { replace: true });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  if (visits.loading) return <><PageHeader title="Commit" /><Loading /></>;
  if (!visit || visit.status !== 'agreed') {
    return (
      <>
        <PageHeader title="Commit" />
        <EmptyState title="Not yet" action={<Button to="/my-seva" variant="soft" size="sm">Go to My Seva</Button>}>
          You can commit only after you and the community have both said yes.
        </EmptyState>
      </>
    );
  }

  return (
    <div className="lg:max-w-2xl">
      <PageHeader title="Commit" subtitle={visit.needTitle} />

      <Card className="p-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-saffron-600">Your rhythm</p>
        <ul className="mt-3 space-y-2 text-[15px] text-ink-800">
          <li className="flex items-center gap-2.5"><Repeat size={18} className="text-saffron-500" /> {WEEKS} weeks, then you choose again</li>
          <li className="flex items-center gap-2.5"><CalendarDays size={18} className="text-saffron-500" /> {rhythm(visit.rhythm)}</li>
          <li className="flex items-start gap-2.5"><MapPin size={18} className="mt-0.5 shrink-0 text-saffron-500" /> {visit.place}</li>
        </ul>
      </Card>

      <WisdomMoment moment="commit" className="mt-4" />

      <div className="mt-6">
        <TextArea
          label="Your commitment, in one sentence"
          hint="Change the words if you like. Your circle and the coordinator see it."
          placeholder="I will come every…"
          rows={3}
          value={sentence}
          maxLength={200}
          onChange={e => setSentence(e.target.value)}
        />
      </div>

      <div className="mt-4"><ErrorNote error={error} /></div>
      <Button block size="lg" className="mt-4" disabled={busy || !sentence.trim()} onClick={commit}>
        Begin {WEEKS} weeks
      </Button>
    </div>
  );
}
