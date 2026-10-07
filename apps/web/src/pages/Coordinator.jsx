import { useEffect, useState } from 'react';
import { Check, CirclePlus, FastForward, RefreshCw, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { firstName, longDate, rhythm, shortDate } from '../lib/format';
import { TopBar } from '../components/ui/Brand';
import { EmptyState, ErrorNote, Loading, SectionTitle, StatusPill, TextArea } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WeekStrip from '../components/WeekStrip';
import DignityCheck from '../components/seva/DignityCheck';
import LanguageToggle from '../components/seva/LanguageToggle';
import { useT } from '../i18n';
import { LANGUAGES as ALL_LANGUAGES } from '../lib/languages';

export default function Coordinator() {
  const t = useT();
  const user = useAuth(s => s.user);
  const overview = useLoad(() => api.get('/api/coordinator/overview'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast();
      await overview.reload({ quiet: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const o = overview.data;

  return (
    <div className="space-y-6">
      <div>
        <TopBar />
        <LanguageToggle className="mt-4" />
        <h1 className="mt-4 font-serif text-2xl font-semibold leading-tight text-ink-900">{t('Vanakkam, {name}', { name: firstName(user?.name) })}</h1>
        <p className="mt-1 text-[15px] text-ink-700">{t('Who is listening, who is serving, and how each week went.')}</p>
        <Button to="/coordinator/post-need" block className="mt-4 lg:w-auto"><CirclePlus /> {t('Post a Need')}</Button>
      </div>

      <ErrorNote error={error || overview.error} onRetry={overview.error ? overview.reload : undefined} />
      {overview.loading && <Loading />}

      {o && (
        <div className="space-y-6 xl:grid xl:grid-cols-[1fr_360px] xl:items-start xl:gap-8 xl:space-y-0">
          <div className="space-y-6">
          <section>
            <SectionTitle>{t('Visits waiting for you')}</SectionTitle>
            {o.pendingVisits.length ? (
              <ul className="space-y-3">
                {o.pendingVisits.map(v => <li key={v._id}><PendingVisit v={v} busy={busy} act={act} /></li>)}
              </ul>
            ) : (
              <p className="rounded-2xl bg-cream-50 px-4 py-3 text-sm text-ink-500 ring-1 ring-cream-300/70">{t('No visits waiting.')}</p>
            )}
          </section>

          {o.listeningUpdates?.length > 0 && (
            <section>
              <SectionTitle>{t('Updated after listening')}</SectionTitle>
              <ul className="space-y-3">
                {o.listeningUpdates.map(u => <li key={u.visitId}><ListeningUpdate u={u} busy={busy} act={act} /></li>)}
              </ul>
            </section>
          )}

          <OpenGaps commitments={o.commitments} />

          <section>
            <SectionTitle>{t('Promise Kept')}</SectionTitle>
            {o.commitments.length ? (
              <ul className="space-y-3">
                {o.commitments.map(c => <li key={c._id}><CommitmentCard c={c} busy={busy} act={act} /></li>)}
              </ul>
            ) : (
              <EmptyState title={t('Nobody serving yet')}>{t('When a volunteer commits, their weeks will show here.')}</EmptyState>
            )}
          </section>
          </div>

          <section className="xl:sticky xl:top-8">
            <SectionTitle>{t('Your needs')}</SectionTitle>
            <Card className="divide-y divide-cream-200">
              {o.needs.map(n => <NeedRow key={n._id} n={n} busy={busy} act={act} />)}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}

// What a volunteer heard → one suggested line for the need card (bridge, /suggest-update). The coordinator
// approves it (as it is or edited), writes their own, or rejects it. Only an approved line reaches the card.
function ListeningUpdate({ u, busy, act }) {
  const [suggestion, setSuggestion] = useState({ status: 'loading' });
  const [text, setText] = useState('');

  useEffect(() => {
    let alive = true;
    api.post('/api/bridge/suggest-update', { needCard: u.need, heardText: u.heardText })
      .then(s => { if (!alive) return; setSuggestion({ status: 'ready', ...s }); setText(s.suggestion || ''); })
      .catch(() => alive && setSuggestion({ status: 'ready', suggestion: null, source: 'none' }));
    return () => { alive = false; };
  }, [u]);

  const answer = (action, line) => act(() => api.patch(`/api/visits/${u.visitId}/update`, { action, text: line }));
  const t = useT();

  return (
    <Card className="p-4" data-testid="listening-update">
      <p className="text-sm text-ink-500">{u.need.title} · {firstName(u.volunteerName)} heard:</p>
      <blockquote className="mt-1 rounded-2xl bg-cream-100 px-4 py-3 font-serif italic text-ink-800">“{u.heardText}”</blockquote>

      {suggestion.status === 'loading' ? (
        <div aria-busy="true" className="mt-3 h-16 animate-pulse rounded-2xl bg-cream-200" />
      ) : (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ember uppercase">
            <RefreshCw size={13} /> {t(suggestion.suggestion ? 'Suggested line for the card' : 'A line for the card (optional)')}
          </p>
          {!suggestion.suggestion && (
            <p className="mt-1 text-sm text-ink-500">{t('Nothing on the card seems to need changing. You can still add a line.')}</p>
          )}
          <TextArea rows={2} maxLength={300} aria-label={t('Line to add to the need card')} value={text} onChange={e => setText(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy || !text.trim()} onClick={() => answer('approve', text)}>
              <Check size={15} /> {t('Add to the card')}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => answer('reject')}>
              <X size={15} /> {t('No, leave the card')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// one of the coordinator's needs. "This need has ended" closes it: a school shut, an organisation moved.
// Every active commitment on it is then complete, and the volunteer is told so without being asked anything.
function NeedRow({ n, busy, act }) {
  const t = useT();
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <div className="px-4 py-3" data-testid="need-row">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink-900">{n.title}</span>
          <span className="block truncate text-xs text-ink-500">{rhythm(n.rhythm)} · {n.orgName}</span>
        </span>
        <StatusPill status={n.status} />
      </div>
      {n.status !== 'closed' && !closing && (
        <button type="button" onClick={() => setClosing(true)} className="mt-1.5 text-xs text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline">
          {t('This need has ended')}
        </button>
      )}
      {closing && (
        <div className="mt-2 space-y-2">
          <input
            className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-ink-900"
            placeholder={t('Why it ended, in a few words (optional)')}
            value={reason}
            maxLength={300}
            onChange={e => setReason(e.target.value)}
          />
          <p className="text-xs text-ink-500">{t('Volunteers serving here will see their seva as complete. They will not be asked to choose anything.')}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(async () => { await api.patch(`/api/needs/${n._id}/close`, { reason }); setClosing(false); })}>{t('Close this need')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setClosing(false)}>{t('Back')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// weeks a volunteer said they cannot come, still waiting for someone from their circle to cover
function OpenGaps({ commitments }) {
  const t = useT();
  const gaps = commitments.flatMap(c => c.sessions
    .filter(s => s.status === 'gap')
    .map(s => ({ ...s, commitmentId: c._id, volunteerName: c.volunteerName, needTitle: c.need.title })));
  return (
    <section>
      <SectionTitle>{t('Open gaps')}</SectionTitle>
      {gaps.length ? (
        <ul className="space-y-2.5">
          {gaps.map(g => (
            <li key={`${g.commitmentId}-${g.week}`}>
              <Card className="p-4">
                <p className="text-[15px] text-ink-800">
                  {t('{name} cannot come in week {week} of {need}.', { name: firstName(g.volunteerName), week: g.week, need: g.needTitle })}
                </p>
                {g.note && <p className="mt-1 text-sm italic text-ink-700">“{g.note}”</p>}
                <p className="mt-1 text-sm text-ink-500">{t('Their circle can see this and cover it.')}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-cream-50 px-4 py-3 text-sm text-ink-500 ring-1 ring-cream-300/70">{t('No open gaps. Every week is served, covered or ahead.')}</p>
      )}
    </section>
  );
}

// After the listening visit the community answers first: an invitation in their words, or not now.
function PendingVisit({ v, busy, act }) {
  const t = useT();
  const [text, setText] = useState(t('They would like you to come back.'));
  const decide = yes => act(() => api.patch(`/api/visits/${v._id}/decision`, yes ? { yes, text } : { yes }));
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink-900">{v.volunteerName}</p>
          <p className="text-sm text-ink-500">{v.needTitle}</p>
        </div>
        <StatusPill status={v.status} />
      </div>

      {v.status === 'requested' && (
        <p className="mt-3 text-sm text-ink-700">{t('Asked to visit. Once they have visited and written what they heard, you can answer.')}</p>
      )}

      {v.status === 'visited' && (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-500">{t('What they heard')}</p>
          <blockquote className="mt-1 rounded-2xl bg-saffron-50 px-4 py-3 font-serif italic text-ink-800">“{v.heardText}”</blockquote>
          <p className="mt-3 text-sm text-ink-700">
            {t('{name} has not been asked anything. Would the group like them to come back?', { name: firstName(v.volunteerName) })}
          </p>
          <label className="mt-3 block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">{t("The group's words")}</span>
            <input
              className="mt-1 w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-ink-900"
              value={text}
              maxLength={300}
              onChange={e => setText(e.target.value)}
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => decide(false)}><X size={16} /> {t('Not now')}</Button>
            <Button size="sm" variant="secondary" disabled={busy || !text.trim()} onClick={() => decide(true)}><Check size={16} /> {t('Invite them back')}</Button>
          </div>
        </>
      )}
    </Card>
  );
}

// No week left uncovered: every week came is served or covered by the circle
function PromiseLine({ c }) {
  const t = useT();
  const kept = c.sessions.some(s => s.status === 'served' || s.status === 'covered');
  if (!kept || c.sessions.some(s => s.status === 'gap')) return null;
  return (
    <p className="mt-3 font-serif text-[15px] italic text-ink-700">
      {t('{group} were never left waiting.', { group: t(c.need.group || 'The community') })}
    </p>
  );
}

const CHECK_IN = [
  ['helping', 'Is this helping?'],
  ['change', 'Should anything change?'],
  ['ownNow', 'What can the group now do on their own?'],
];

// Community Check-in, every 4 weeks: asked in person, entered here. The community can end the arrangement.
function CheckIn({ c, busy, act }) {
  const t = useT();
  const [answers, setAnswers] = useState({ helping: '', change: '', ownNow: '' });
  const [end, setEnd] = useState(false);
  const ready = CHECK_IN.every(([k]) => answers[k].trim());
  return (
    <section aria-labelledby={`check-in-${c._id}`} className="mt-4 rounded-2xl bg-cream-100 p-4" data-testid="check-in">
      <h3 id={`check-in-${c._id}`} className="font-serif text-lg font-semibold text-ink-900">{t('Community Check-in')}</h3>
      <p className="mt-1 text-sm text-ink-500">{t('Ask the group these three questions in person, then write down what they said.')}</p>
      <div className="mt-3 space-y-3">
        {CHECK_IN.map(([k, q]) => (
          <TextArea key={k} label={t(q)} rows={2} maxLength={500} value={answers[k]}
            onChange={e => setAnswers(a => ({ ...a, [k]: e.target.value }))} />
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-ink-800">
        <input type="checkbox" checked={end} onChange={e => setEnd(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-saffron-strong" />
        {t('The community would like to end this arrangement.')}
      </label>
      <Button size="sm" variant="secondary" className="mt-3" disabled={busy || !ready}
        onClick={() => act(() => api.post(`/api/commitments/${c._id}/check-in`, { ...answers, end }))}>
        <Check size={15} /> {t('Save the check-in')}
      </Button>
    </section>
  );
}

function LastCheckIn({ checkIn }) {
  const t = useT();
  return (
    <details className="mt-4 rounded-2xl ring-1 ring-cream-300 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-700">
        {t('Check-in, week {week}', { week: checkIn.week })}{checkIn.ended ? t(' — the community ended the arrangement') : ''}
      </summary>
      <dl className="space-y-2 px-4 pb-4 text-sm">
        {CHECK_IN.map(([k, q]) => (
          <div key={k}><dt className="font-semibold text-ink-900">{t(q)}</dt><dd className="text-ink-700">{checkIn[k]}</dd></div>
        ))}
      </dl>
    </details>
  );
}

const LANGUAGES = ALL_LANGUAGES.map(l => [l.code, l.label]);

// "What the group wanted to say": one optional line relayed from the group once the seva has finished,
// about the group and never a named person. The Dignity Check runs on it; the coordinator approves; then it is
// stored as said and shown to the volunteer as the community's words.
function CommunityWords({ c, busy, act }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en');
  const [status, setStatus] = useState({ ready: false });
  const [approved, setApproved] = useState(false);
  const fields = [{ key: 'words', label: t('What the group wanted to say'), value: text }];

  if (c.communityWords) {
    return (
      <div className="mt-3 rounded-2xl bg-saffron-50 px-4 py-3" data-testid="community-words">
        <p className="text-xs font-semibold uppercase tracking-wider text-saffron-700">{t("The group's words, relayed")}</p>
        <p lang={c.communityWords.language} className="mt-1 font-serif text-[15px] italic text-ink-900">“{c.communityWords.text}”</p>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm font-medium text-saffron-700 underline-offset-2 hover:underline">
        {t('Add what the group wanted to say')}
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-cream-100 p-4" data-testid="community-words-form">
      <p className="text-sm font-semibold text-ink-900">{t('What the group wanted to say')}</p>
      <p className="-mt-2 text-[13px] text-ink-500">{t('One line, in the language it was said. About the group, never a named person.')}</p>
      <div className="flex gap-2">
        {LANGUAGES.map(([code, label]) => (
          <button key={code} type="button" onClick={() => setLanguage(code)}
            className={`rounded-full px-3 py-1 text-sm ${language === code ? 'bg-ink-800 text-cream-50' : 'bg-cream-50 text-ink-700 ring-1 ring-cream-300'}`}>
            {label}
          </button>
        ))}
      </div>
      <TextArea
        rows={2}
        maxLength={300}
        lang={language}
        aria-label={t('What the group wanted to say')}
        placeholder={t('They said the Saturday mornings were theirs now.')}
        value={text}
        onChange={e => { setText(e.target.value); setApproved(false); }}
      />
      {text.trim() && <DignityCheck live fields={fields} onUse={(k, v) => setText(v)} onStatus={setStatus} />}
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-800">
        <input type="checkbox" checked={approved} disabled={!status.ready} onChange={e => setApproved(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-saffron-strong" />
        {t('I checked these words and they speak of the group, not of any one person.')}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy || !text.trim() || !status.ready || !approved}
          onClick={() => act(() => api.post(`/api/commitments/${c._id}/community-words`, { text, language, dignityChecked: true }))}>
          {t('Relay to {name}', { name: firstName(c.volunteerName) })}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('Back')}</Button>
      </div>
    </div>
  );
}

function CommitmentCard({ c, busy, act }) {
  const t = useT();
  const [text, setText] = useState('');
  const [communityWants, setCommunityWants] = useState(false);
  const [week, setWeek] = useState(c.currentWeek);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink-900">{c.volunteerName}</p>
          <p className="text-sm text-ink-500">{c.need.title}</p>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold text-saffron-600">{t('Week {week} of {weeks}', { week: c.currentWeek, weeks: c.weeks })}</span>
      </div>

      <WeekStrip sessions={c.sessions} currentWeek={c.currentWeek} className="mt-3" />
      <PromiseLine c={c} />
      {c.checkInDue && <CheckIn c={c} busy={busy} act={act} />}
      {c.checkIns?.length > 0 && <LastCheckIn checkIn={c.checkIns.at(-1)} />}

      {c.status === 'paused' ? (
        <p className="mt-4 text-sm text-ink-700">
          <StatusPill status="paused" /> {t('{name} plans to come back on {date}.', { name: firstName(c.volunteerName), date: longDate(c.pausedUntil) })}
        </p>
      ) : c.status === 'finished' && c.lastChoice === 'community-ended' ? (
        <p className="mt-4 text-sm text-ink-700">
          <StatusPill status="finished" /> {t('The community ended this arrangement at the check-in. The need is closed.')}
        </p>
      ) : c.status === 'finished' ? (
        <div className="mt-4 text-sm text-ink-700">
          <StatusPill status="finished" />{' '}
          {c.lastChoice === 'need-closed'
            ? t("The need ended. {name}'s seva here is complete.", { name: firstName(c.volunteerName) })
            : t('{name} finished and left a handover. The need is open again.', { name: firstName(c.volunteerName) })}
          {c.handover?.note && <p className="mt-2 rounded-2xl bg-cream-100 px-4 py-3 italic">“{c.handover.note}”</p>}
          <CommunityWords c={c} busy={busy} act={act} />
        </div>
      ) : c.invitation ? (
        <p className="mt-4 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          {t('Invitation sent {date}:', { date: shortDate(c.invitation.sentAt) })} <span className="font-serif italic">“{c.invitation.text}”</span>
        </p>
      ) : (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink-900">{t('Would the community like {name} to continue?', { name: firstName(c.volunteerName) })}</p>
          <label className="mt-2 flex cursor-pointer items-start gap-2.5 text-sm text-ink-800">
            <input
              type="checkbox"
              checked={communityWants}
              onChange={e => setCommunityWants(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-saffron-strong"
            />
            {t('I asked the community, and they would like {name} to continue.', { name: firstName(c.volunteerName) })}
          </label>
          <div className="mt-3">
            <TextArea
              rows={2}
              aria-label={t('Invitation to continue')}
              placeholder={t('The children asked if you are coming next month.')}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>
          <Button size="sm" variant="secondary" className="mt-2" disabled={busy || !communityWants || !text.trim()}
            onClick={() => act(async () => { await api.post(`/api/commitments/${c._id}/invitation`, { text }); setText(''); })}>
            <Send size={15} /> {t('Send invitation')}
          </Button>
        </div>
      )}

      {/* demo control: move the commitment forward in time */}
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-cream-300 px-3 py-2.5">
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-ink-500">{t('Demo: time travel')}</span>
        <label className="sr-only" htmlFor={`week-${c._id}`}>Week</label>
        <select
          id={`week-${c._id}`}
          value={week}
          onChange={e => setWeek(Number(e.target.value))}
          className="h-9 rounded-full bg-cream-50 px-3 text-sm ring-1 ring-cream-300"
        >
          {c.sessions.map(s => <option key={s.week} value={s.week}>Week {s.week}</option>)}
        </select>
        <Button size="sm" variant="soft" disabled={busy || week === c.currentWeek}
          onClick={() => act(() => api.post('/api/demo/advance', { commitmentId: c._id, toWeek: week }))}>
          <FastForward size={15} /> Go
        </Button>
      </div>
    </Card>
  );
}
