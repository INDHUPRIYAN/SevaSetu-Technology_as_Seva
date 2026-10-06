// /reflect/:commitmentId — the private Seva Diary (endpoints 21, 22, 23; the week comes from A's 13).
// One question, its teaching line, a text box (no mic: the diary never leaves for a third party),
// "This was a hard day", Save, Skip. No score, no streak, no count of entries, no share button.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/seva/PageHeader';
import { Check, ChevronRight, Leaf, Lock, Pages } from '../components/seva/icons';

const needTitleOf = c => c?.need?.title || c?.needTitle || c?.title || '';

export default function Diary() {
  const { commitmentId } = useParams();
  const navigate = useNavigate();
  const user = useAuth(s => s.user);
  const isCoordinator = user?.role === 'coordinator';

  const [load, setLoad] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState('');
  const [hardDay, setHardDay] = useState(false);
  const [save, setSave] = useState({ status: 'idle' });

  useEffect(() => {
    if (isCoordinator) return undefined;
    let alive = true;
    setLoad({ status: 'loading' });
    (async () => {
      try {
        const commitment = await api.get(`/api/commitments/${commitmentId}`);
        const week = Number(commitment?.currentWeek) || 1;
        const [question, list] = await Promise.all([
          api.get('/api/reflect/question', { params: { commitmentId, week } }),
          api.get('/api/reflect/entries', { params: { commitmentId } }),
        ]);
        if (!alive) return;
        const thisWeek = list.find(e => e.week === week);
        setEntries(list);
        setText(thisWeek?.text || '');
        setHardDay(!!thisWeek?.hardDay);
        setLoad({ status: 'ready', week, needTitle: needTitleOf(commitment), question });
      } catch (e) {
        if (alive) setLoad({ status: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [commitmentId, isCoordinator, attempt]);

  function goBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/my-seva');
  }

  async function onSave(e) {
    e.preventDefault();
    if (!text.trim() || save.status === 'saving') return;
    setSave({ status: 'saving' });
    try {
      const entry = await api.post('/api/reflect/entries', {
        commitmentId, week: load.week, questionId: load.question._id, text, hardDay,
      });
      setEntries(list => [...list.filter(x => x.week !== entry.week), entry].sort((a, b) => a.week - b.week));
      setText(entry.text);
      setSave({ status: 'saved' });
    } catch (err) {
      setSave({ status: 'error', message: err?.message || 'Could not save just now. Please try again.' });
    }
  }

  const shell = children => <div className="@container mx-auto w-full max-w-5xl px-4 pt-6 pb-10 @2xl:px-6">{children}</div>;

  if (isCoordinator) {
    return shell(
      <>
        <PageHeader back={{ to: '/coordinator', label: 'Dashboard' }} eyebrow="Seva Diary" title="This diary is private" />
        <Card className="mt-5 flex gap-4 p-5 @2xl:p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-peach text-saffron"><Lock /></span>
          <p className="text-base leading-relaxed text-ink-soft">
            Only the volunteer who serves can read their Seva Diary. Coordinators never see it, and nothing in it is
            shared, scored or summarised.
          </p>
        </Card>
      </>,
    );
  }

  if (load.status === 'loading') {
    return shell(
      <div aria-busy="true" aria-live="polite">
        <p className="sr-only">Opening your diary…</p>
        <div className="h-9 w-40 animate-pulse rounded-xl bg-peach" />
        <div className="mt-5 h-72 animate-pulse rounded-3xl bg-peach-soft" />
      </div>,
    );
  }

  if (load.status === 'error') {
    return shell(
      <>
        <PageHeader back={{ to: '/my-seva', label: 'My Seva' }} eyebrow="Seva Diary" title="Your diary" />
        <Card className="mt-5 p-5 @2xl:p-6" role="alert">
          <p className="text-base text-ink">We could not open this diary just now.</p>
          <Button variant="secondary" className="mt-4" onClick={() => setAttempt(n => n + 1)}>Try again</Button>
        </Card>
      </>,
    );
  }

  const { week, needTitle, question } = load;
  const saving = save.status === 'saving';

  return shell(
    <>
      <PageHeader back={{ to: '/my-seva', label: 'My Seva' }} eyebrow="Seva Diary" title={`Week ${week}`} subtitle={needTitle} />

      <div className="mt-5 grid gap-5 @3xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] @3xl:items-start">
        <Card className="p-5 @2xl:p-7">
          <form onSubmit={onSave} aria-labelledby="diary-question">
            <h2 id="diary-question" className="font-serif text-2xl leading-snug font-semibold text-ink @2xl:text-[1.7rem]">
              {question.text}
            </h2>
            <p className="mt-2 flex items-center gap-2 text-base text-ember italic">
              <Leaf className="size-5 shrink-0" /> {question.teaching}
            </p>

            <label htmlFor="diary-text" className="sr-only">Your answer</label>
            <textarea
              id="diary-text"
              rows={6}
              value={text}
              maxLength={4000}
              onChange={e => { setText(e.target.value); if (save.status !== 'saving') setSave({ status: 'idle' }); }}
              placeholder="Write a few honest lines, in any language."
              className="mt-5 block w-full resize-y rounded-2xl border border-line bg-white/80 px-4 py-3 text-base leading-relaxed
                text-ink placeholder:text-ink-soft/70 focus:border-saffron focus:ring-3 focus:ring-saffron/25 focus:outline-none"
            />

            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink">
              <input
                type="checkbox"
                checked={hardDay}
                onChange={e => { setHardDay(e.target.checked); setSave({ status: 'idle' }); }}
                className="size-5 shrink-0 accent-saffron-strong"
              />
              This was a hard day
            </label>

            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-peach-soft px-4 py-3 text-sm text-ink-soft">
              <Lock className="mt-0.5 size-4 shrink-0 text-ember" />
              <span><strong className="font-semibold text-ink">Only you can see this.</strong> Not your circle, not the coordinator.</span>
            </p>

            <div className="mt-5 flex flex-col-reverse gap-3 @md:flex-row @md:justify-end">
              <Button variant="secondary" onClick={goBack} disabled={saving}>Skip</Button>
              <Button type="submit" disabled={!text.trim() || saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
            <div aria-live="polite" className="min-h-6">
              {save.status === 'saved' && (
                <p className="mt-3 flex items-center justify-end gap-1.5 text-sm font-semibold text-ember">
                  <Check className="size-4" /> Saved in your diary
                </p>
              )}
              {save.status === 'error' && <p className="mt-3 text-right text-sm text-ember" role="alert">{save.message}</p>}
            </div>
          </form>
        </Card>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="past-entries">
            <h2 id="past-entries" className="font-serif text-xl font-semibold text-ink">Your past entries</h2>
            {entries.length === 0 ? (
              <p className="mt-2 text-base text-ink-soft">Your words will appear here after you save them.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-3">
                {entries.map(e => (
                  <li key={e._id || e.week}>
                    <Card className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ember">Week {e.week}</span>
                        {e.week === week && <span className="rounded-full bg-peach px-2 py-0.5 text-xs font-semibold text-ink">This week</span>}
                        {e.hardDay && <span className="rounded-full bg-track px-2 py-0.5 text-xs text-ink-soft">A hard day</span>}
                      </div>
                      {e.question?.text && <p className="mt-1 text-sm text-ink-soft">{e.question.text}</p>}
                      <p className="mt-2 font-serif text-lg leading-snug whitespace-pre-line text-ink break-words">{e.text}</p>
                    </Card>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Link
            to={`/reflect/${commitmentId}/then-and-now`}
            className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card hover:bg-peach-soft"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-peach text-saffron"><Pages /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-ink">Then and Now</span>
              <span className="block text-sm text-ink-soft">Your first words beside your latest</span>
            </span>
            <ChevronRight className="size-5 text-ember transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </>,
  );
}
