// STAND-IN for Person A's AppShell. Bottom nav on a phone, top nav on a laptop.
// Add ?shell=narrow to any URL to squeeze the app into a 430 px column, like A's plan describes,
// and check that B's pages still fit (they size themselves by their container, not the window).
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../stand-ins/auth';
import { Wordmark } from './Logo';

function readNarrow(params) {
  try {
    if (params.has('shell')) sessionStorage.setItem('shell', params.get('shell'));
    return sessionStorage.getItem('shell') === 'narrow';
  } catch (e) {
    return params.get('shell') === 'narrow';
  }
}

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export default function AppShell() {
  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const narrow = readNarrow(params);
  const isCoordinator = user?.role === 'coordinator';

  const tabs = [
    { to: '/', label: 'Home', d: 'M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z', end: true },
    isCoordinator
      ? { to: '/coordinator', label: 'Dashboard', d: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z', end: true }
      : { to: '/my-seva', label: 'My Seva', d: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2 .8 3 2.8 3 6' },
    { to: '/wisdom', label: 'Wisdom', d: 'M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1V19c-3-1-6-1-9 1-3-2-6-2-9-1V5.5ZM12 6.5V20' },
  ];

  const tabClass = ({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium
    lg:min-h-11 lg:flex-none lg:flex-row lg:gap-2 lg:rounded-full lg:px-4 lg:text-sm
    ${isActive ? 'text-saffron lg:bg-peach' : 'text-ink-soft hover:text-ink'}`;

  return (
    <div className={`mx-auto flex min-h-dvh w-full flex-col ${narrow ? 'max-w-[430px] border-x border-line' : 'max-w-6xl'}`}>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-cream/90 px-4 py-3 backdrop-blur lg:px-6">
        <Wordmark />
        <nav aria-label="Main" className={`hidden gap-1 ${narrow ? '' : 'lg:flex'}`}>
          {tabs.map(t => <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}><Icon d={t.d} />{t.label}</NavLink>)}
        </nav>
        <button
          type="button"
          onClick={() => { logout(); navigate('/login'); }}
          className="min-h-11 shrink-0 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-peach-soft"
        >
          {user?.name?.split(' ')[0]} · Switch
        </button>
      </header>

      <main className="flex-1 pb-24 lg:pb-8">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className={`fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)]
          backdrop-blur ${narrow ? 'max-w-[430px]' : 'lg:hidden'}`}
      >
        {tabs.map(t => <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}><Icon d={t.d} />{t.label}</NavLink>)}
      </nav>
    </div>
  );
}
