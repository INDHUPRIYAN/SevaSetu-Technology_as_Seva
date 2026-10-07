// VoiceBridge, step 1 of Post a Need: the coordinator speaks or types naturally; the app asks only what is
// missing, one question at a time (at most three); the Need Card builds live underneath. Not a chatbot: one
// large mic, the text box always there, a calm list of what was said and asked. The browser holds the turns
// and the draft and sends them with every call (the bridge is stateless and stores nothing). When nothing is
// missing, or three questions have been asked, "Check the card" hands the draft to the form, with any empty
// field marked for typing. The coordinator's own words are kept, in their language, as the original.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import Button from '../ui/Button';
import VoiceInput from './VoiceInput';
import { useT } from '../../i18n';

const FIELD_LABEL = {
  want: 'What we want', place: 'Place', day: 'Day', start: 'Time', weeks: 'Weeks', serveUsWell: 'How to serve us well',
  youWillLearn: 'What you will learn', related: 'Same place as an earlier card?',
};
const empty = v => v === '' || v === 0 || v == null;
const PLACEHOLDER = {
  ta: 'எ.கா. 6 முதல் 8 ஆம் வகுப்பு மாணவர்கள் 12 பேருக்கு…',
  hi: 'जैसे: कक्षा 6 से 8 के 12 छात्र…',
  en: 'e.g. 12 students of class 6 to 8 want help reading English aloud…',
};

export default function VoiceBridge({ language, context, speech, onCard }) {
  const t = useT();
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState(null);
  const [answer, setAnswer] = useState({ question: null, missing: [], readBack: '', source: null, relatedCardId: null });
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => { if (typeof endRef.current?.scrollIntoView === 'function') endRef.current.scrollIntoView({ block: 'nearest' }); }, [turns.length]);

  const said = turns.filter(x => x.role === 'coordinator');
  const done = said.length > 0 && !busy && answer.question === null;
  const askedCount = turns.filter(x => x.role === 'app').length;

  async function send(e) {
    e?.preventDefault();
    const text = words.trim();
    if (!text || busy) return;
    const next = [...turns, { role: 'coordinator', text }];
    setBusy(true);
    setError('');
    try {
      const data = await api.post('/api/bridge/voicebridge', { language, turns: next, draft, context });
      const withQuestion = data.question
        ? [...next, { role: 'app', text: data.question.text, field: data.question.field, relatedCardId: data.relatedCardId || undefined }]
        : next;
      setTurns(withQuestion);
      setDraft(data.draft);
      setAnswer({ question: data.question, missing: data.missing, readBack: data.readBack, source: data.source, relatedCardId: data.relatedCardId });
      setWords('');
    } catch (err) {
      setError(err?.message || t('We could not understand that just now. Please try again, or type.'));
    } finally {
      setBusy(false);
    }
  }

  function check() {
    if (!draft) return;
    onCard({
      draft,
      original: { text: said.map(x => x.text).join('\n'), language },
      missing: answer.missing,
      source: answer.source,
      readBack: answer.readBack,
    });
  }

  const prompt = answer.question ? answer.question.text
    : said.length === 0 ? t('Tell me about the need, the way the community said it.')
    : t('Thank you. Nothing more is needed; check the card below.');

  return (
    <div className="mt-5 flex flex-col gap-5" data-testid="voicebridge">
      <section className="rounded-2xl border border-line bg-surface p-4 @2xl:p-6" aria-label={t('Conversation')}>
        {turns.length > 0 && (
          <ol className="mb-4 space-y-2" aria-label={t('What was said')}>
            {turns.map((x, i) => (
              <li key={i} className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${x.role === 'app'
                ? 'bg-peach-soft text-ink'
                : 'ml-auto bg-white text-ink ring-1 ring-line'}`} lang={x.role === 'coordinator' ? language : undefined}>
                {x.role === 'app' && <span className="mr-1.5 text-xs font-semibold tracking-wide text-ember uppercase">{t('Asked')}</span>}
                {x.text}
              </li>
            ))}
            <li ref={endRef} aria-hidden="true" />
          </ol>
        )}

        <p className="font-serif text-xl leading-snug text-ink" lang={answer.question ? language : undefined} data-testid="voicebridge-prompt">
          {prompt}
        </p>
        {answer.question && (
          <p className="mt-1 text-sm text-ink-soft">
            {t('Question {n} of 3', { n: askedCount })} · {t(FIELD_LABEL[answer.question.field] || answer.question.field)}
          </p>
        )}

        <form onSubmit={send} className="mt-4">
          <VoiceInput
            id="need-words"
            label={answer.question ? t('Your answer') : t('What does the community need?')}
            hint={said.length === 0 ? t('Describe the group, the day, the time and the place. Please do not name anyone.') : undefined}
            value={words}
            onChange={setWords}
            lang={language}
            rows={3}
            speech={speech}
            big
            placeholder={PLACEHOLDER[language] || PLACEHOLDER.en}
          />
          {error && <p className="mt-2 text-sm font-medium text-ember" role="alert">{error}</p>}
          <div className="mt-3 flex flex-col-reverse gap-2 @md:flex-row @md:justify-end">
            {draft && (
              <Button type="button" variant={done ? 'primary' : 'secondary'} onClick={check} disabled={busy}>
                {t('Check the card')}
              </Button>
            )}
            <Button type="submit" disabled={!words.trim() || busy}>
              {busy && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
              {busy ? t('Listening…') : t('Send')}
            </Button>
          </div>
        </form>
      </section>

      {draft && (
        <section className="rounded-2xl border border-line bg-surface p-4 @2xl:p-6" aria-labelledby="live-card" data-testid="live-card">
          <div className="flex items-start justify-between gap-3">
            <h2 id="live-card" className="font-serif text-lg font-semibold text-ink">{t('The card so far')}</h2>
            <span className="text-xs font-semibold tracking-wide text-ember uppercase">
              {answer.source === 'ai' ? t('Suggested — please review') : t('Built from your words')}
            </span>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 @md:grid-cols-2">
            {[
              ['title', t('Title'), draft.title],
              ['want', t('What we want'), draft.want],
              ['place', t('Place'), draft.place],
              ['day', t('Day'), draft.rhythm.day],
              ['start', t('Time'), draft.rhythm.start ? `${draft.rhythm.start}${draft.rhythm.end ? ` – ${draft.rhythm.end}` : ''}` : ''],
              ['weeks', t('Weeks'), draft.weeks || ''],
              ['serveUsWell', t('How to serve us well'), draft.serveUsWell],
              ['youWillLearn', t('What you will learn'), draft.youWillLearn],
            ].map(([key, label, value]) => (
              <div key={key} className={`rounded-xl px-3 py-2 ${empty(value) ? 'bg-warn/50 ring-1 ring-warn-line/60' : 'bg-white/60'}`} data-field={key} data-empty={empty(value) ? 'true' : 'false'}>
                <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
                <dd className="mt-0.5 text-[15px] text-ink">{empty(value) ? <span className="text-warn-ink">{t('Still needed')}</span> : value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
