// STAND-IN for A's coordinator dashboard: the link to Post a Need and the needs published so far.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../stand-ins/api';
import { SEEDED_COMMITMENT } from './demoIds';

export default function Coordinator() {
  const [needs, setNeeds] = useState([]);
  useEffect(() => { api.get('/api/needs').then(setNeeds).catch(() => {}); }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4 pb-8 lg:px-6">
      <h1 className="font-serif text-3xl font-semibold">Coordinator dashboard</h1>
      <Link to="/coordinator/post-need" className="inline-flex min-h-12 w-fit items-center rounded-full bg-saffron-strong px-6 font-semibold text-white shadow-pill">
        Post a Need
      </Link>
      <section aria-labelledby="published">
        <h2 id="published" className="font-serif text-xl font-semibold">Open needs</h2>
        <ul className="mt-2 flex flex-col gap-2" data-testid="open-needs">
          {needs.map(n => (
            <li key={n._id} className="rounded-2xl border border-line bg-surface p-4">
              <span className="block font-semibold">{n.title}</span>
              <span className="block text-sm text-ink-soft">{n.rhythm.day} {n.rhythm.start}–{n.rhythm.end} · {n.place}</span>
            </li>
          ))}
        </ul>
      </section>
      <Link to={`/reflect/${SEEDED_COMMITMENT}`} className="text-sm text-ink-soft underline">Seeded volunteer's diary URL (should show nothing)</Link>
    </div>
  );
}
