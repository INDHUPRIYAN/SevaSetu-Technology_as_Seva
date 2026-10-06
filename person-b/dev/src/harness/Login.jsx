// STAND-IN for A's /login: the demo users as cards (endpoints 1 and 2, served by the mock gateway).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../stand-ins/api';
import { useAuth } from '../stand-ins/auth';
import { Wordmark } from './Logo';

export default function Login() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const login = useAuth(s => s.login);
  const navigate = useNavigate();

  useEffect(() => { api.get('/api/auth/users').then(setUsers).catch(() => setError('The gateway is not running.')); }, []);

  async function pick(user) {
    const { token, user: me } = await api.post('/api/auth/demo-login', { userId: user._id });
    login(token, me);
    navigate(me.role === 'coordinator' ? '/coordinator' : '/');
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Wordmark />
      <h1 className="font-serif text-3xl font-semibold">Who is serving today?</h1>
      {error && <p role="alert" className="text-ember">{error}</p>}
      <ul className="flex flex-col gap-3">
        {users.map(u => (
          <li key={u._id}>
            <button
              type="button"
              onClick={() => pick(u)}
              className="flex min-h-16 w-full items-center justify-between rounded-3xl border border-line bg-surface px-5 text-left shadow-card hover:bg-peach-soft"
            >
              <span>
                <span className="block text-lg font-semibold">{u.name}</span>
                <span className="block text-sm text-ink-soft">{u.note}</span>
              </span>
              <span className="rounded-full bg-peach px-3 py-1 text-xs font-semibold text-ember capitalize">{u.role}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
