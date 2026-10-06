// /coordinator/post-need — the Seva Bridge (VoiceBridge, then A's endpoint 6).
// Step 1: language, then speak or type naturally; the app asks only what is missing (one question at a
// time, at most three) and the card builds live (VoiceBridge). Step 2: edit every field, with the Dignity
// Check over the card and the original words. Step 3: tick "I read this back…" → Publish. The AI never
// publishes; a person does. The original words are stored with the need, in their language.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/seva/PageHeader';
import VoiceBridge from '../components/seva/VoiceBridge';
import WhyLink from '../components/seva/WhyLink';
import DignityCheck from '../components/seva/DignityCheck';
import LanguageToggle from '../components/seva/LanguageToggle';
import { useT } from '../i18n';
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
  const t = useT();
  const steps = ['Say or type', 'Check the card', 'Read back & publish'].map(k => t(k));
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
  const t = useT();
  const user = useAuth(s => s.user);
  const navigate = useNavigate();

  const [language, setLanguage] = useState('ta');
  const [result, setResult] = useState(null);          // { source: 'ai' | 'rules', readBack }
  const [original, setOriginal] = useState(null);      // { text, language }: the words as said, kept with the need
  // what the bridge has: a model (labels say "Suggested") and a speech provider (else the browser's own)
  const [capabilities, setCapabilities] = useState(null);
  // context for VoiceBridge: this coordinator's own last 5 cards, from the overview (no new store)
  const [context, setContext] = useState({ recentCards: [] });
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.get('/api/bridge/capabilities')).then(c => alive && c && setCapabilities(c)).catch(() => {});
    Promise.resolve(api.get('/api/coordinator/overview')).then(o => {
      if (!alive || !o?.needs) return;
      setContext({
        orgName: o.needs[0]?.orgName || '',
        recentCards: o.needs.slice(0, 5).map(n => ({ _id: n._id, title: n.title, place: n.place, rhythm: n.rhythm, weeks: n.weeks })),
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const [form, setForm] = useState(null);
  const [touched, setTouched] = useState(false);
  const [readBack, setReadBack] = useState(false);          // the community heard it and confirmed
  const [dignity, setDignity] = useState({ ready: false });   // the Dignity Check ran on these words and every flag has an answer
  const [consent, setConsent] = useState(false);            // the coordinator consents to publish
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'coordinator') return <Navigate to="/" replace />;

  // VoiceBridge hands over the card it built; any field still missing is marked for typing
  function onCard({ draft, original: said, missing, source, readBack: spoken }) {
    const next = draftToForm(draft);
    if (!draft.weeks) next.weeks = '';                 // never a silent default: the coordinator types it
    setResult({ source: source === 'ai' ? 'ai' : 'rules', readBack: spoken || '' });
    setOriginal(said);
    setForm(next);
    setTouched(missing.length > 0);
    setReadBack(false);
    setConsent(false);
    setPublishError('');
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
    if (!readBack || !consent || !dignity.ready || publishing) return;
    if (Object.keys(errors).length) {
      document.getElementById(`need-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    setPublishing(true);
    setPublishError('');
    try {
      await api.post('/api/needs', formToNeed(form, undefined, original));
      toast(t('Published'));
      navigate('/coordinator');
    } catch (err) {
      setPublishError(err?.message || t('The need could not be published. Please try again.'));
      setPublishing(false);
    }
  }

  function startAgain() {
    setForm(null);
    setResult(null);
    setOriginal(null);
    setReadBack(false);
    setConsent(false);
  }

  const step = !form ? 1 : readBack && consent ? 3 : 2;
  const tags = form ? splitTags(form.interests) : [];

  return (
    <div className="@container mx-auto w-full max-w-4xl pt-6 pb-10 lg:mx-0 lg:pt-0">
      <PageHeader
        back={{ to: '/coordinator', label: t('Dashboard') }}
        eyebrow={t('Seva Bridge')}
        title={t('Post a Need')}
        subtitle={t('Say it the way the community said it. We will turn it into a card for you to check.')}
      />
      <LanguageToggle className="mt-3" />
      <Steps step={step} />

      <div hidden={Boolean(form)}>
        <Card className="mt-5 p-4 @2xl:p-6">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">{t('Language')}</legend>
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
        </Card>
        <VoiceBridge language={language} context={context} speech={capabilities ? capabilities.speech : undefined} onCard={onCard} />
      </div>

      {form && (
        <form onSubmit={publish} noValidate className="mt-5 flex flex-col gap-5">
          <DignityCheck
            fields={[
              { key: 'original', label: t('In the community’s words (shown on the card)'), value: original?.text || '' },
              { key: 'title', label: t('Title'), value: form.title },
              { key: 'want', label: t('What we want'), value: form.want },
              { key: 'serveUsWell', label: t('How to serve us well'), value: form.serveUsWell },
              { key: 'youWillLearn', label: t('What you will learn'), value: form.youWillLearn },
              { key: 'place', label: t('Place'), value: form.place },
            ]}
            onUse={(key, rewrite) => (key === 'original'
              ? setOriginal(o => ({ ...o, text: rewrite }))
              : setForm(f => ({ ...f, [key]: rewrite })))}
            onStatus={setDignity}
            expectAi={Boolean(capabilities?.llm)}
          />

          {result.source === 'ai' ? (
            <p className="text-xs font-semibold tracking-wide text-ember uppercase">{t('Suggested draft — please check every field')}</p>
          ) : (
            <p className="rounded-2xl bg-peach-soft px-4 py-3 text-sm text-ink-soft">
              {t('Built from your words by simple rules, with no AI. Please check every field; any marked field still needs you.')}
            </p>
          )}

          <Card className="p-4 @2xl:p-6">
            <h2 className="font-serif text-xl font-semibold text-ink">{t('Check the card')}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t('Every field can be changed.')}</p>
            {original?.text && (
              <div className="mt-4">
                <Field id="need-original" label={t('In the community’s words')} hint={t('Shown on the card as it was said. You can change it.')}>
                  <textarea
                    id="need-original"
                    rows={3}
                    lang={original.language}
                    value={original.text}
                    onChange={e => setOriginal(o => ({ ...o, text: e.target.value }))}
                    className={`${INPUT} border-line`}
                  />
                </Field>
              </div>
            )}

            <div className="mt-5 grid gap-4 @2xl:grid-cols-2">
              <div className="@2xl:col-span-2">
                <Field id="need-title" label={t('Title')} error={shownErrors.title}><input type="text" maxLength={140} {...inputProps('title')} /></Field>
              </div>
              <div className="@2xl:col-span-2">
                <Field id="need-want" label={t('What we want')} error={shownErrors.want}><textarea rows={3} {...inputProps('want')} /></Field>
              </div>
              <Field id="need-serveUsWell" label={t('How to serve us well')} error={shownErrors.serveUsWell}>
                <textarea rows={3} {...inputProps('serveUsWell')} />
              </Field>
              <Field id="need-youWillLearn" label={t('What you will learn')} error={shownErrors.youWillLearn}>
                <textarea rows={3} {...inputProps('youWillLearn')} />
              </Field>
              <Field id="need-place" label={t('Place')} error={shownErrors.place}><input type="text" {...inputProps('place')} /></Field>
              <Field id="need-groupSize" label={t('Group size')} error={shownErrors.groupSize}>
                <input type="number" inputMode="numeric" min={1} max={500} {...inputProps('groupSize')} />
              </Field>
              <div className="@2xl:col-span-2">
                <Field id="need-interests" label={t('Interests')} error={shownErrors.interests} hint={t('Separate with commas, e.g. teaching, reading')}>
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
              <legend className="mb-2 text-sm font-semibold text-ink">{t('Rhythm')}</legend>
              <div className="grid gap-4 @md:grid-cols-2 @2xl:grid-cols-4">
                <Field id="need-day" label={t('Day')} error={shownErrors.day}>
                  <select {...inputProps('day')}>
                    <option value="">{t('Pick a day')}</option>
                    {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field id="need-start" label={t('From')} error={shownErrors.start}><input type="time" {...inputProps('start')} /></Field>
                <Field id="need-end" label={t('To')} error={shownErrors.end}><input type="time" {...inputProps('end')} /></Field>
                <Field id="need-weeks" label={t('Weeks')} error={shownErrors.weeks}>
                  <input type="number" inputMode="numeric" min={1} max={52} {...inputProps('weeks')} />
                </Field>
              </div>
            </fieldset>
          </Card>

          <Card className="p-4 @2xl:p-6">
            <h2 className="font-serif text-xl font-semibold text-ink">{t('Please read this back to the community.')}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {t('Read the card aloud, in their language, before it goes out. Change anything they did not say.')}
              <WhyLink rule="community-confirmation" />
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-base text-ink">
              <input
                type="checkbox"
                checked={readBack}
                onChange={e => setReadBack(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-saffron-strong"
              />
              <span>{t('I read this card back to the community, and')} <strong className="font-semibold">{t('they confirmed it')}</strong>.</span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-base text-ink">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-saffron-strong"
              />
              <span>{t('As the coordinator,')} <strong className="font-semibold">{t('I consent to publishing this need')}</strong>.</span>
            </label>

            {!dignity.ready && readBack && consent && (
              <p className="mt-3 text-sm text-ink-soft" data-testid="dignity-gate">
                {dignity.failed ? t('The Dignity Check could not run. Check again before you publish.')
                  : dignity.changed ? t('The card changed since the Dignity Check. Check again before you publish.')
                  : dignity.flagged && !dignity.decided ? t('Please answer each Dignity Check flag above (use the rewrite, or keep your words) before you publish.')
                  : t('Waiting for the Dignity Check…')}
              </p>
            )}
            {touched && Object.keys(errors).length > 0 && (
              <p className="mt-3 text-sm font-medium text-ember" role="alert">{t('Please fill the fields marked above.')}</p>
            )}
            {publishError && <p className="mt-3 text-sm font-medium text-ember" role="alert">{publishError}</p>}

            <div className="mt-5 flex flex-col-reverse gap-3 @md:flex-row @md:justify-between">
              <Button variant="secondary" onClick={startAgain} disabled={publishing}>{t('Start again')}</Button>
              <Button type="submit" disabled={!readBack || !consent || !dignity.ready || publishing}>{t(publishing ? 'Publishing…' : 'Publish need')}</Button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
