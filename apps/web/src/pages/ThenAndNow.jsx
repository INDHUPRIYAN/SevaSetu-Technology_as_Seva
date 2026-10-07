// /reflect/:commitmentId/then-and-now — the first entry beside the latest (endpoint 24).
// Her sealed Sankalpa above them (endpoint 24c), what they gave her (24e) and, once the seva has finished,
// the community's words relayed by the coordinator (core). Side by side on a wide screen, stacked on a phone.
// No number, score or chart; just her words, and theirs.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/seva/PageHeader';
import { Lock, Pen } from '../components/seva/icons';
import { VoiceNotePlayer } from '../components/seva/VoiceNote';

function SankalpaCard({ text }) {
  return (
    <figure className="mt-5 rounded-2xl border border-line bg-surface px-5 py-4 text-center @2xl:px-8 @2xl:py-6">
      <figcaption className="flex items-center justify-center gap-1.5 text-sm font-semibold tracking-wide text-ember uppercase">
        <Lock className="size-4" /> Your Sankalpa
      </figcaption>
      <blockquote className="mt-2 font-serif text-xl leading-snug text-ink italic break-words @2xl:text-2xl">“{text}”</blockquote>
    </figure>
  );
}

// one short labelled quotation: what they gave her (her words), or the community's words (theirs, as said)
export function VoiceCard({ label, text, lang, children, testId }) {
  return (
    <figure className="mt-4 rounded-2xl border border-line bg-surface px-5 py-4 @2xl:px-8 @2xl:py-5" data-testid={testId}>
      <figcaption className="text-sm font-semibold tracking-wide text-ember uppercase">{label}</figcaption>
      <blockquote lang={lang} className="mt-2 font-serif text-lg leading-snug text-ink italic break-words @2xl:text-xl">“{text}”</blockquote>
      {children}
    </figure>
  );
}

function EntryCard({ label, entry, accent }) {
  return (
    <Card className={`flex h-full flex-col p-4 @2xl:p-6 ${accent ? 'bg-white' : ''}`}>
      <h2 className="text-sm font-semibold tracking-wide text-ember uppercase">{label}</h2>
      {entry.question?.text && <p className="mt-2 text-base text-ink-soft">{entry.question.text}</p>}
      <blockquote className="mt-3 font-serif text-xl leading-snug whitespace-pre-line text-ink break-words @2xl:text-2xl">
        “{entry.text}”
      </blockquote>
    </Card>
  );
}

// the first and the latest voice note, played back only here (the list has no audio; each note is fetched by week)
async function voiceNotes(commitmentId) {
  try {
    const list = await api.get('/api/reflect/voice', { params: { commitmentId } });
    if (!list?.length) return { first: null, latest: null };
    const weeks = [list[0].week, list[list.length - 1].week];
    const [first, latest] = await Promise.all(weeks.map(week => api.get('/api/reflect/voice', { params: { commitmentId, week } })));
    return { first, latest: weeks[0] === weeks[1] ? null : latest };
  } catch (e) { return { first: null, latest: null }; }
}

export default function ThenAndNow() {
  const { commitmentId } = useParams();
  const [state, setState] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    Promise.all([
      api.get('/api/reflect/then-and-now', { params: { commitmentId } }),
      api.get('/api/reflect/sankalpa', { params: { commitmentId } }).catch(() => null),   // her words still show without it
      api.get('/api/reflect/received', { params: { commitmentId } }).catch(() => null),
      api.get(`/api/commitments/${commitmentId}`).catch(() => null),                        // for the community's words
      voiceNotes(commitmentId),                                                              // her own voice notes: first week and latest
    ])
      .then(([data, sankalpa, received, commitment, voices]) => alive && setState({
        status: 'ready', first: data?.first || null, latest: data?.latest || null, sankalpa: sankalpa?.text || null,
        received: received?.text || null, communityWords: commitment?.communityWords || null,
        voiceFirst: voices.first, voiceLatest: voices.latest,
      }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => { alive = false; };
  }, [commitmentId, attempt]);

  const diaryLink = `/reflect/${commitmentId}`;

  return (
    <div className="@container mx-auto w-full max-w-5xl pt-6 pb-10 lg:mx-0 lg:pt-0">
      <PageHeader back={{ to: diaryLink, label: 'Seva Diary' }} eyebrow="Seva Diary" title="Then and Now" />

      {state.status === 'loading' && (
        <div className="mt-5 grid gap-4 @2xl:grid-cols-2" aria-busy="true">
          <p className="sr-only" aria-live="polite">Opening your entries…</p>
          <div className="h-48 animate-pulse rounded-2xl bg-peach-soft" />
          <div className="h-48 animate-pulse rounded-2xl bg-peach-soft" />
        </div>
      )}

      {state.status === 'error' && (
        <Card className="mt-5 p-4" role="alert">
          <p className="text-base text-ink">We could not open your entries just now.</p>
          <Button variant="secondary" className="mt-4" onClick={() => setAttempt(n => n + 1)}>Try again</Button>
        </Card>
      )}

      {state.status === 'ready' && state.sankalpa && <SankalpaCard text={state.sankalpa} />}
      {state.status === 'ready' && state.received && <VoiceCard label="What they gave you" text={state.received} testId="received" />}
      {state.status === 'ready' && state.communityWords && (
        <VoiceCard label="The community's words" text={state.communityWords.text} lang={state.communityWords.language} testId="community-words">
          <p className="mt-2 text-xs text-ink-soft">Relayed by their coordinator, as it was said.</p>
        </VoiceCard>
      )}

      {state.status === 'ready' && !state.first && (
        <Card className="mt-5 flex flex-col items-start gap-4 p-6 @2xl:flex-row @2xl:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-peach text-saffron"><Pen /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-semibold text-ink">Your story here begins with a few words</h2>
            <p className="mt-1 text-base text-ink-soft">
              After you write in your Seva Diary, your first words will wait here. In the weeks to come, your newest words
              will sit beside them.
            </p>
          </div>
          <Link to={diaryLink} className="inline-flex min-h-12 items-center rounded-full bg-saffron-strong px-6 font-semibold text-white hover:bg-saffron-deep">
            Open your diary
          </Link>
        </Card>
      )}

      {state.status === 'ready' && (state.voiceFirst || state.voiceLatest) && (
        <div className="mt-4 grid gap-4 @2xl:grid-cols-2" data-testid="voice-then-and-now">
          <VoiceNotePlayer note={state.voiceFirst} label={`Then · week ${state.voiceFirst?.week}`} />
          {state.voiceLatest && <VoiceNotePlayer note={state.voiceLatest} label={`Now · week ${state.voiceLatest.week}`} />}
        </div>
      )}

      {state.status === 'ready' && state.first && (
        <div className="mt-5 grid gap-4 @2xl:grid-cols-2" data-testid="then-and-now">
          <EntryCard label="Then" entry={state.first} />
          {state.latest ? (
            <EntryCard label="Now" entry={state.latest} accent />
          ) : (
            <Card className="flex h-full flex-col justify-center border-dashed p-4 @2xl:p-6">
              <h2 className="text-sm font-semibold tracking-wide text-ember uppercase">Now</h2>
              <p className="mt-2 text-base text-ink-soft">
                Write again in a coming week, and your newest words will appear here beside these.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
