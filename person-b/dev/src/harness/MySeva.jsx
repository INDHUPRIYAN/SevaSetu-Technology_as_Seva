// STAND-IN for A's My Seva: the links into B's diary, and the "Why?" for no hours.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../stand-ins/api';
import { useAuth } from '../stand-ins/auth';
import { WhyLink } from '../personBRoutes';
import { NEW_VOLUNTEER_COMMITMENT, SEEDED_COMMITMENT } from './demoIds';

export default function MySeva() {
  const user = useAuth(s => s.user);
  const commitmentId = user?._id === '650000000000000000000001' ? NEW_VOLUNTEER_COMMITMENT : SEEDED_COMMITMENT;
  const [c, setC] = useState(null);
  useEffect(() => { api.get(`/api/commitments/${commitmentId}`).then(setC).catch(() => setC(false)); }, [commitmentId]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4 pb-8 lg:px-6">
      <h1 className="font-serif text-3xl font-semibold">My Seva</h1>
      {c === false && <p className="text-ink-soft">You have no commitment yet.</p>}
      {c && (
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm font-semibold text-ember">Week {c.currentWeek} of {c.weeks}</p>
          <p className="mt-1 font-serif text-xl font-semibold">{c.need.title}</p>
          <div className="mt-3 h-2 rounded-full bg-track">
            <div className="h-2 rounded-full bg-saffron" style={{ width: `${(c.currentWeek / c.weeks) * 100}%` }} />
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-ink-soft">We mark the weeks you come. <WhyLink rule="no-hours" /></div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={`/reflect/${commitmentId}`} className="inline-flex min-h-12 items-center rounded-full bg-saffron-strong px-6 font-semibold text-white shadow-pill">Open Seva Diary</Link>
            <Link to={`/reflect/${commitmentId}/then-and-now`} className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-semibold text-ember">Then and Now</Link>
          </div>
        </div>
      )}
      <Link to="/needs/demo" className="text-sm font-semibold text-ember underline">Open a need card (Why? links)</Link>
    </div>
  );
}
