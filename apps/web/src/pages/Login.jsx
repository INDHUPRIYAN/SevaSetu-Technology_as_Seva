import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { homeFor, useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { Wordmark } from '../components/ui/Brand';
import { Avatar, ErrorNote, Loading } from '../components/ui/Bits';

export default function Login() {
  const navigate = useNavigate();
  const { token, user, login } = useAuth();
  const users = useLoad(() => api.get('/api/auth/users'));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  if (token) return <Navigate to={homeFor(user)} replace />;

  async function pick(u) {
    setBusy(u._id);
    setError(null);
    try {
      const session = await api.post('/api/auth/demo-login', { userId: u._id });
      login(session);
      navigate(homeFor(session.user), { replace: true });
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  }

  const volunteers = users.data?.filter(u => u.role === 'volunteer') || [];
  const coordinators = users.data?.filter(u => u.role === 'coordinator') || [];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-cream-100 lg:grid lg:max-w-none lg:grid-cols-[1.15fr_1fr]">
      <div className="relative overflow-hidden px-4 pt-[max(env(safe-area-inset-top),24px)] pb-8 lg:sticky lg:top-0 lg:h-dvh lg:px-14 lg:pt-12">
        <div className="relative">
          <Wordmark size="lg" />
          <p className="mt-8 max-w-[13rem] font-serif text-[24px] font-semibold leading-tight text-ink-900 lg:mt-24 lg:max-w-md lg:text-[24px] lg:leading-[1.1]">
            Who is serving today?
          </p>
          <p className="mt-5 hidden max-w-sm text-lg leading-relaxed text-ink-800 lg:block">
            Find a need near you, visit to listen first, and give four steady weeks with a circle beside you.
          </p>
        </div>
      </div>

      <div className="relative space-y-6 px-4 pb-10 lg:mx-auto lg:mt-0 lg:flex lg:w-full lg:max-w-lg lg:flex-col lg:justify-center lg:px-10 lg:py-16">
        <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-700">
          This is a demo. Pick a person to see SevaSetu through their eyes. No password needed.
        </p>
        <ErrorNote error={error || users.error} onRetry={users.error ? users.reload : undefined} />
        {users.loading && <Loading label="Finding people" />}

        {!!volunteers.length && <UserGroup title="Volunteers" users={volunteers} busy={busy} onPick={pick} />}
        {!!coordinators.length && <UserGroup title="Community coordinators" users={coordinators} busy={busy} onPick={pick} />}
      </div>
    </div>
  );
}

function UserGroup({ title, users, busy, onPick }) {
  return (
    <section>
      <h2 className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-wider text-ink-500">{title}</h2>
      <ul className="space-y-2.5">
        {users.map(u => (
          <li key={u._id}>
            <button
              onClick={() => onPick(u)}
              disabled={!!busy}
              className="flex w-full items-center gap-3.5 rounded-2xl bg-cream-50 p-4 text-left shadow-card ring-1 ring-cream-300/70 transition hover:ring-saffron-300 active:scale-[0.99] disabled:opacity-60"
            >
              <Avatar name={u.name} />
              <span className="flex-1">
                <span className="block font-semibold text-ink-900">{u.name}</span>
                <span className="text-sm capitalize text-ink-500">{u.role}</span>
              </span>
              {busy === u._id
                ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-saffron-200 border-t-saffron-500" />
                : <ChevronRight className="text-saffron-500" size={20} />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
