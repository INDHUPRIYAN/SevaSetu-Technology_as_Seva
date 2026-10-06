// A teaching shown at one moment of the journey (endpoint 27b): Verified teaching → Interpretation →
// Practice, each labelled. The quote is left out until it is verified; our own words still show.
// moment: 'before-listen' | 'commit' | 'hard-day' | 'continue'.
// If the call fails it shows nothing, so the screen around it never breaks.
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { WisdomBook } from './icons';

export default function WisdomMoment({ moment, className = '' }) {
  const [m, setM] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get(`/api/wisdom/moment/${encodeURIComponent(moment)}`)
      .then(data => { if (alive && data?.interpretation) setM(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [moment]);

  if (!m) return null;

  return (
    <aside aria-label={m.title} className={`rounded-2xl border border-line bg-white p-4 ${className}`}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ember">
        <WisdomBook className="size-5 shrink-0" /> {m.title}
      </p>
      <dl className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-soft">
        {m.teaching && (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ember uppercase">Verified teaching</dt>
            <dd className="mt-1">
              <blockquote className="font-serif text-lg leading-snug text-ink italic">“{m.teaching.quote}”</blockquote>
              <p className="mt-1 text-xs">— Swami Vivekananda, {m.teaching.source}</p>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-semibold tracking-wide text-ember uppercase">Interpretation</dt>
          <dd className="mt-1">{m.interpretation}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-ember uppercase">Practice</dt>
          <dd className="mt-1 text-ink">{m.practice}</dd>
        </div>
      </dl>
    </aside>
  );
}
