// Listening Guide on the guest briefing: 3 open questions to ask on the listening visit (bridge,
// /listening-guide). AI questions are labelled "Suggested". If the bridge cannot be reached, the same
// three general questions the bridge falls back to are shown.
import { useEffect, useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { api } from '../../lib/api';

const GENERAL = [
  'What would you like a volunteer to know before they begin?',
  'What has helped the group most so far, and what has not?',
  'What would a good session together look like to you?',
];

export default function ListeningGuide({ need, className = '' }) {
  const [guide, setGuide] = useState(null);

  useEffect(() => {
    let alive = true;
    const { title, want, serveUsWell, youWillLearn, place } = need;
    api.post('/api/bridge/listening-guide', { title, want, serveUsWell, youWillLearn, place })
      .then(g => alive && setGuide(g?.questions?.length ? g : { questions: GENERAL, source: 'fallback' }))
      .catch(() => alive && setGuide({ questions: GENERAL, source: 'fallback' }));
    return () => { alive = false; };
  }, [need]);

  return (
    <section aria-labelledby="listening-guide" className={`rounded-2xl bg-cream-100 p-4 ${className}`}>
      <h3 id="listening-guide" className="flex flex-wrap items-center gap-2 font-serif text-lg font-semibold text-ink-900">
        <MessageCircleQuestion size={18} className="text-saffron-500" /> Listening Guide
        {guide?.source === 'ai' && <span className="text-xs font-semibold tracking-wide text-ember uppercase">Suggested — please review</span>}
      </h3>
      <p className="mt-1 text-sm text-ink-500">Three questions to ask. Then listen, and let them answer in their own time.</p>
      {!guide ? (
        <div aria-busy="true" className="mt-3 space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-5 animate-pulse rounded bg-cream-200" />)}
        </div>
      ) : (
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink-800">
          {guide.questions.map(q => <li key={q}>{q}</li>)}
        </ol>
      )}
    </section>
  );
}
