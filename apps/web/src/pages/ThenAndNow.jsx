// /reflect/:commitmentId/then-and-now — the first entry beside the latest (endpoint 24).
// Side by side on a wide screen, stacked on a phone. No number, score or chart; just her words.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/seva/PageHeader';
import { Pen } from '../components/seva/icons';

function EntryCard({ label, entry, accent }) {
  return (
    <Card className={`flex h-full flex-col p-5 @2xl:p-6 ${accent ? 'bg-linear-to-b from-peach-soft to-surface' : ''}`}>
      <h2 className="text-sm font-semibold tracking-wide text-ember uppercase">{label} — Week {entry.week}</h2>
      {entry.question?.text && <p className="mt-2 text-base text-ink-soft">{entry.question.text}</p>}
      <blockquote className="mt-3 font-serif text-xl leading-snug whitespace-pre-line text-ink break-words @2xl:text-2xl">
        “{entry.text}”
      </blockquote>
    </Card>
  );
}

export default function ThenAndNow() {
  const { commitmentId } = useParams();
  const [state, setState] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    api.get('/api/reflect/then-and-now', { params: { commitmentId } })
      .then(data => alive && setState({ status: 'ready', first: data?.first || null, latest: data?.latest || null }))
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
          <div className="h-48 animate-pulse rounded-3xl bg-peach-soft" />
          <div className="h-48 animate-pulse rounded-3xl bg-peach-soft" />
        </div>
      )}

      {state.status === 'error' && (
        <Card className="mt-5 p-5" role="alert">
          <p className="text-base text-ink">We could not open your entries just now.</p>
          <Button variant="secondary" className="mt-4" onClick={() => setAttempt(n => n + 1)}>Try again</Button>
        </Card>
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
          <Link to={diaryLink} className="inline-flex min-h-12 items-center rounded-full bg-saffron-strong px-6 font-semibold text-white shadow-pill hover:bg-saffron-deep">
            Open your diary
          </Link>
        </Card>
      )}

      {state.status === 'ready' && state.first && (
        <div className="mt-5 grid gap-4 @2xl:grid-cols-2" data-testid="then-and-now">
          <EntryCard label="Then" entry={state.first} />
          {state.latest ? (
            <EntryCard label="Now" entry={state.latest} accent />
          ) : (
            <Card className="flex h-full flex-col justify-center border-dashed p-5 @2xl:p-6">
              <h2 className="text-sm font-semibold tracking-wide text-ember uppercase">Now</h2>
              <p className="mt-2 text-base text-ink-soft">
                Write again in a coming week, and your newest words will appear here beside these.
              </p>
            </Card>
          )}
        </div>
      )}

      {state.status === 'ready' && (
        <figure className="mt-8 text-center">
          <blockquote className="font-serif text-2xl leading-snug text-ink italic @2xl:text-3xl">
            “They alone live who live for others.”
          </blockquote>
          <figcaption className="mt-2 text-sm text-ink-soft">— Swami Vivekananda</figcaption>
        </figure>
      )}
    </div>
  );
}
