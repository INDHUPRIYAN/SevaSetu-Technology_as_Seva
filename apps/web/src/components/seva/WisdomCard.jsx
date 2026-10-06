// "Seva Wisdom for Today" (endpoint 25). If the call fails, it shows nothing, so Home never breaks
// because reflect-service is down. Until a quote is verified the endpoint has none; with `plain`, the
// card then carries a teaching in our own plain words, never presented as a quotation.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import Card from '../ui/Card';
import { ChevronRight, WisdomBook } from './icons';

const PLAIN = 'Go to listen before you go to help. Help that begins with listening respects the people it is for.';

export default function WisdomCard({ plain = false }) {
  const [wisdom, setWisdom] = useState(undefined);       // undefined: loading or failed; null: none verified yet

  useEffect(() => {
    let alive = true;
    api.get('/api/wisdom/today')
      .then(w => { if (alive) setWisdom(w?.text ? w : null); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (wisdom === undefined || (wisdom === null && !plain)) return null;

  return (
    <section aria-labelledby="seva-wisdom-today">
      <Card className="p-4">
        <div className="flex gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-peach text-saffron">
            <WisdomBook />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="seva-wisdom-today" className="text-[13px] font-semibold tracking-wide text-ember uppercase">
              {wisdom ? 'Seva Wisdom for Today' : 'A thought for today'}
            </h2>
            {wisdom ? (
              <>
                <blockquote className="mt-1 font-serif text-lg leading-snug text-ink italic break-words">“{wisdom.text}”</blockquote>
                <p className="mt-2 text-[13px] text-ink-soft">
                  — Swami Vivekananda
                  <span className="mt-0.5 block">{wisdom.source}</span>
                </p>
              </>
            ) : (
              <p className="mt-1 font-serif text-lg leading-snug text-ink break-words">{PLAIN}</p>
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <Link to="/wisdom" className="inline-flex min-h-10 items-center gap-1 text-[15px] font-semibold text-ember hover:underline">
            Read More <ChevronRight />
          </Link>
        </div>
      </Card>
    </section>
  );
}
