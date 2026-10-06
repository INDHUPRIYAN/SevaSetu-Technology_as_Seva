// "Seva Wisdom for Today" (endpoint 25). No props. If the call fails, it shows nothing,
// so Home never breaks because reflect-service is down.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import Card from '../ui/Card';
import { ChevronRight, WisdomBook } from './icons';

export default function WisdomCard() {
  const [wisdom, setWisdom] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/api/wisdom/today')
      .then(w => { if (alive && w?.text) setWisdom(w); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!wisdom) return null;

  return (
    <section aria-labelledby="seva-wisdom-today" className="@container">
      <Card className="relative overflow-hidden bg-linear-to-br from-surface via-surface to-peach-soft p-5 @md:p-6">
        <div className="flex gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-peach text-saffron @md:size-14">
            <WisdomBook className="size-6 @md:size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="seva-wisdom-today" className="text-base font-semibold text-ember @md:text-lg">
              Seva Wisdom for Today
            </h2>
            <blockquote className="mt-1.5 font-serif text-lg leading-snug text-ink italic break-words @md:text-xl">
              “{wisdom.text}”
            </blockquote>
            <p className="mt-2 text-sm text-ink-soft">
              — Swami Vivekananda
              <span className="mt-0.5 block text-xs text-ink-soft/90">{wisdom.source}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Link
            to="/wisdom"
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-5 text-sm
              font-semibold text-ember shadow-sm transition-colors hover:bg-peach-soft"
          >
            Read More <ChevronRight className="size-4" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
