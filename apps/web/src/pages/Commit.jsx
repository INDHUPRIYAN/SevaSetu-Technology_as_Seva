import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Lock, MapPin, Repeat } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useLoad } from '../lib/useLoad';
import { rhythm, time } from '../lib/format';
import { EmptyState, ErrorNote, Loading, PageHeader, TextArea } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WisdomMoment from '../components/seva/WisdomMoment';
import { Ramp } from './ListenFirst';

const WEEKS = 4;

export default function Commit() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const visits = useLoad(() => api.get('/api/visits/mine'));
  const visit = visits.data?.find(v => v._id === visitId);
  const [sentence, setSentence] = useState('');
  const [sankalpa, setSankalpa] = useState('');
  const [committedId, setCommittedId] = useState(null);   // set once the commitment exists, so a retry only seals
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // start from the fixed rhythm; the volunteer can change the words
  useEffect(() => {
    if (visit?.rhythm?.day && !sentence) {
      const r = visit.rhythm;
      setSentence(`I will come every ${r.day}${r.start ? ` from ${time(r.start)}` : ''}${r.end ? ` to ${time(r.end)}` : ''} for ${WEEKS} weeks.`);
    }
  }, [visit]); // eslint-disable-line react-hooks/exhaustive-deps

  // the commitment goes to core; the Sankalpa is sealed in the private reflect service, under her own id
  async function commit() {
    setBusy(true);
    setError(null);
    let id = committedId;
    try {
      if (!id) {
        id = (await api.post('/api/commitments', { visitId, weeks: WEEKS, sentence }))._id;
        setCommittedId(id);
      }
      await api.post('/api/reflect/sankalpa', { commitmentId: id, text: sankalpa });
      toast();
      navigate('/my-seva', { replace: true });
    } catch (e) {
      setError(id
        ? { message: 'Your commitment is saved, but your Sankalpa could not be sealed. Try again.' }
        : e);
      setBusy(false);
    }
  }

  if (visits.loading) return <><PageHeader title="Commit" /><Loading /></>;
  if (!visit || (visit.status !== 'invited' && !committedId)) {
    return (
      <>
        <PageHeader title="Commit" />
        <EmptyState title="Not yet" action={<Button to="/my-seva" variant="soft" size="sm">Go to My Seva</Button>}>
          You can commit only after you have visited and the community has invited you back.
        </EmptyState>
      </>
    );
  }

  return (
    <div className="lg:max-w-2xl">
      <PageHeader title="Commit" subtitle={visit.needTitle} />
      <Ramp at={2} className="mb-3" />

      {visit.invitation?.text && (
        <blockquote className="mb-4 rounded-2xl bg-saffron-50 px-4 py-3 font-serif italic text-ink-800">
          “{visit.invitation.text}”
          <footer className="mt-1 font-sans text-xs not-italic text-ink-500">The community's invitation</footer>
        </blockquote>
      )}

      <Card className="p-4">
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
          disabled={Boolean(committedId)}
          onChange={e => setSentence(e.target.value)}
        />
      </div>

      <div className="mt-6">
        <TextArea
          label="Your Sankalpa: what do you hope to learn here?"
          hint="One line, for yourself. It is about what you hope to learn, not what you will deliver."
          placeholder="I hope to learn…"
          rows={2}
          value={sankalpa}
          maxLength={300}
          onChange={e => setSankalpa(e.target.value)}
        />
        <p className="mt-2 flex items-start gap-2 text-sm text-ink-500">
          <Lock size={15} className="mt-0.5 shrink-0" />
          Only you can see it. It is sealed now, and you will read it again at Then and Now.
        </p>
      </div>

      <div className="mt-4"><ErrorNote error={error} /></div>
      <Button block size="lg" className="mt-4" disabled={busy || !sentence.trim() || !sankalpa.trim()} onClick={commit}>
        {committedId ? 'Seal my Sankalpa' : `Begin ${WEEKS} weeks`}
      </Button>
    </div>
  );
}
