// /coordinator/post-need — the Seva Bridge (endpoint 28, then A's endpoint 6).
// Step 1: language + say or type the need → Make draft. Step 2: edit every field, with yellow privacy
// warnings. Step 3: tick "I read this back…" → Publish. The AI never publishes; a person does.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/seva/PageHeader';
import VoiceInput from '../components/seva/VoiceInput';
import WhyLink from '../components/seva/WhyLink';
import { Warning } from '../components/seva/icons';
import {
  DRAFT_LANGUAGES, WEEKDAYS, draftToForm, formToNeed, splitTags, validateForm,
} from '../components/seva/needDraft';

const INPUT = `block w-full rounded-2xl border bg-white/80 px-4 py-3 text-base text-ink placeholder:text-ink-soft/70
  focus:border-saffron focus:ring-3 focus:ring-saffron/25 focus:outline-none`;

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-sm font-medium text-ember">{error}</p>}
    </div>
  );
}

function Steps({ step }) {
  const steps = ['Say or type', 'Check the card', 'Read back & publish'];
  return (
    <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Steps">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'current' : 'next';
        return (
          <li key={label} aria-current={state === 'current' ? 'step' : undefined} className="flex flex-col gap-1.5">
            <span className={`h-1.5 rounded-full ${state === 'next' ? 'bg-track' : 'bg-saffron'}`} />
            <span className={`text-xs font-semibold @md:text-sm ${state === 'next' ? 'text-ink-soft' : 'text-ink'}`}>
              {n}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function PostNeed() {
  const user = useAuth(s => s.user);
  const navigate = useNavigate();

  const [language, setLanguage] = useState('ta');
  const [words, setWords] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [result, setResult] = useState(null);          // { privacyFlags, source }
  const [form, setForm] = useState(null);
  const [touched, setTouched] = useState(false);
  const [readBack, setReadBack] = useState(false);          // the community heard it and confirmed
  const [consent, setConsent] = useState(false);            // the coordinator consents to publish
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'coordinator') return <Navigate to="/" replace />;

  async function makeDraft(e) {
    e.preventDefault();
    if (!words.trim() || drafting) return;
    setDrafting(true);
    setDraftError('');
    try {
      const data = await api.post('/api/bridge/draft-need', { text: words, language });
      setResult({ privacyFlags: data.privacyFlags || [], source: data.source });
      setForm(draftToForm(data.draft));
      setTouched(false);
      setReadBack(false);
      setConsent(false);
      setPublishError('');
    } catch (err) {
      setDraftError(err?.message || 'We could not make a draft just now. Please try again.');
    } finally {
      setDrafting(false);
    }
  }

  const errors = form ? validateForm(form) : {};
  const shownErrors = touched ? errors : {};
  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));
  const inputProps = field => ({
    id: `need-${field}`,
    value: form[field],
    onChange: set(field),
    'aria-invalid': shownErrors[field] ? true : undefined,
    'aria-describedby': shownErrors[field] ? `need-${field}-error` : undefined,
    className: `${INPUT} ${shownErrors[field] ? 'border-ember' : 'border-line'}`,
  });

  async function publish(e) {
    e.preventDefault();
    setTouched(true);
    if (!readBack || !consent || publishing) return;
    if (Object.keys(errors).length) {
      document.getElementById(`need-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    setPublishing(true);
    setPublishError('');
    try {
      await api.post('/api/needs', formToNeed(form));
      navigate('/coordinator');
    } catch (err) {
      setPublishError(err?.message || 'The need could not be published. Please try again.');
      setPublishing(false);
    }
  }

  function startAgain() {
    setForm(null);
    setResult(null);
    setReadBack(false);
    setConsent(false);
  }

  const step = !form ? 1 : readBack && consent ? 3 : 2;
  const tags = form ? splitTags(form.interests) : [];

  return (
    <div className="@container mx-auto w-full max-w-4xl pt-6 pb-10 lg:mx-0 lg:pt-0">
      <PageHeader
        back={{ to: '/coordinator', label: 'Dashboard' }}
        eyebrow="Seva Bridge"
        title="Post a Need"
        subtitle="Say it the way the community said it. We will turn it into a card for you to check."
      />
      <Steps step={step} />

      {!form && (
        <Card className="mt-5 p-5 @2xl:p-7">
          <form onSubmit={makeDraft}>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">Language</legend>
              <div className="flex flex-wrap gap-2">
                {DRAFT_LANGUAGES.map(l => (
                  <label
                    key={l.code}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-base font-semibold
                      has-focus-visible:outline-3 has-focus-visible:outline-saffron ${language === l.code
                      ? 'border-saffron-strong bg-saffron-strong text-white'
                      : 'border-line bg-surface text-ink hover:bg-peach-soft'}`}
                  >
                    <input
                      type="radio"
                      name="language"
                      value={l.code}
                      checked={language === l.code}
                      onChange={() => setLanguage(l.code)}
                      className="sr-only"
                    />
                    <span lang={l.code}>{l.label}</span>
                    {l.code !== 'en' && <span className="text-sm font-normal opacity-80">{l.name}</span>}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5">
              <VoiceInput
                id="need-words"
                label="What does the community need?"
                hint="Describe the group, the day, the time and the place. Please do not name anyone."
                value={words}
                onChange={setWords}
                lang={language}
                rows={6}
                placeholder={language === 'ta'
                  ? 'எ.கா. 6 முதல் 8 ஆம் வகுப்பு மாணவர்கள் 12 பேருக்கு…'
                  : 'e.g. 12 students of class 6 to 8 want help reading English aloud…'}
              />
            </div>

            {draftError && <p className="mt-3 text-sm font-medium text-ember" role="alert">{draftError}</p>}

            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={!words.trim() || drafting} className="w-full @md:w-auto">
                {drafting && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                {drafting ? 'Making the draft…' : 'Make draft'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {form && (
        <form onSubmit={publish} noValidate className="mt-5 flex flex-col gap-5">
          {result.privacyFlags.length > 0 && (
            <div role="alert" className="rounded-3xl border border-warn-line bg-warn p-5 text-warn-ink" data-testid="privacy-warnings">
              <p className="flex items-center gap-2 text-base font-semibold">
                <Warning className="size-5 shrink-0" /> Please check before publishing
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-9 text-sm">
                {result.privacyFlags.map(flag => <li key={flag}>{flag}</li>)}
              </ul>
              <p className="mt-2 pl-7 text-sm">Describe the group, never one person. Remove names, money, caste, religion and health details.</p>
            </div>
          )}

          {result.source === 'fallback' && (
            <p className="rounded-2xl bg-peach-soft px-4 py-3 text-sm text-ink-soft">
              The drafting helper is resting, so this is a sample card. Please change every field to match what the
              community said.
            </p>
          )}

          <Card className="p-5 @2xl:p-7">
            <h2 className="font-serif text-xl font-semibold text-ink">Check the card</h2>
            <p className="mt-1 text-sm text-ink-soft">Every field can be changed.</p>

            <div className="mt-5 grid gap-4 @2xl:grid-cols-2">
              <div className="@2xl:col-span-2">
                <Field id="need-title" label="Title" error={shownErrors.title}><input type="text" maxLength={140} {...inputProps('title')} /></Field>
              </div>
              <div className="@2xl:col-span-2">
                <Field id="need-want" label="What we want" error={shownErrors.want}><textarea rows={3} {...inputProps('want')} /></Field>
              </div>
              <Field id="need-serveUsWell" label="How to serve us well" error={shownErrors.serveUsWell}>
                <textarea rows={3} {...inputProps('serveUsWell')} />
              </Field>
              <Field id="need-youWillLearn" label="What you will learn" error={shownErrors.youWillLearn}>
                <textarea rows={3} {...inputProps('youWillLearn')} />
              </Field>
              <Field id="need-place" label="Place" error={shownErrors.place}><input type="text" {...inputProps('place')} /></Field>
              <Field id="need-groupSize" label="Group size" error={shownErrors.groupSize}>
                <input type="number" inputMode="numeric" min={1} max={500} {...inputProps('groupSize')} />
              </Field>
              <div className="@2xl:col-span-2">
                <Field id="need-interests" label="Interests" error={shownErrors.interests} hint="Separate with commas, e.g. teaching, reading">
                  <input type="text" {...inputProps('interests')} />
                </Field>
                {tags.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="Interests on the card">
                    {tags.map(t => <li key={t} className="rounded-full bg-peach px-3 py-1 text-sm text-ink">{t}</li>)}
                  </ul>
                )}
              </div>
            </div>

            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-semibold text-ink">Rhythm</legend>
              <div className="grid gap-4 @md:grid-cols-2 @2xl:grid-cols-4">
                <Field id="need-day" label="Day" error={shownErrors.day}>
                  <select {...inputProps('day')}>
                    <option value="">Pick a day</option>
                    {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field id="need-start" label="From" error={shownErrors.start}><input type="time" {...inputProps('start')} /></Field>
                <Field id="need-end" label="To" error={shownErrors.end}><input type="time" {...inputProps('end')} /></Field>
                <Field id="need-weeks" label="Weeks" error={shownErrors.weeks}>
                  <input type="number" inputMode="numeric" min={1} max={52} {...inputProps('weeks')} />
                </Field>
              </div>
            </fieldset>
          </Card>

          <Card className="p-5 @2xl:p-7">
            <h2 className="font-serif text-xl font-semibold text-ink">Please read this back to the community.</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Read the card aloud, in their language, before it goes out. Change anything they did not say.
              <WhyLink rule="community-confirmation" />
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-base text-ink">
              <input
                type="checkbox"
                checked={readBack}
                onChange={e => setReadBack(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-saffron-strong"
              />
              <span>I read this card back to the community, and <strong className="font-semibold">they confirmed it</strong>.</span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-base text-ink">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-saffron-strong"
              />
              <span>As the coordinator, <strong className="font-semibold">I consent to publishing this need</strong>.</span>
            </label>

            {touched && Object.keys(errors).length > 0 && (
              <p className="mt-3 text-sm font-medium text-ember" role="alert">Please fill the fields marked above.</p>
            )}
            {publishError && <p className="mt-3 text-sm font-medium text-ember" role="alert">{publishError}</p>}

            <div className="mt-5 flex flex-col-reverse gap-3 @md:flex-row @md:justify-between">
              <Button variant="secondary" onClick={startAgain} disabled={publishing}>Start again</Button>
              <Button type="submit" disabled={!readBack || !consent || publishing}>{publishing ? 'Publishing…' : 'Publish need'}</Button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
