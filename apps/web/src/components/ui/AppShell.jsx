import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, CircleUser, House, LayoutDashboard, CirclePlus, LogOut, Package, Search, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { Wordmark } from './Brand';
import { Avatar } from './Bits';

const volunteerTabs = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/opportunities', label: 'Opportunities', icon: Search },
  { to: '/my-seva', label: 'My Seva', icon: Users },
  { to: '/wisdom', label: 'Wisdom', icon: BookOpen },
  { to: '/profile', label: 'Profile', icon: CircleUser },
];

const coordinatorTabs = [
  { to: '/coordinator', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/coordinator/post-need', label: 'Post a Need', icon: CirclePlus },
  { to: '/coordinator/resources', label: 'Resources', icon: Package },
  { to: '/wisdom', label: 'Wisdom', icon: BookOpen },
  { to: '/profile', label: 'Profile', icon: CircleUser },
];

// Phone: one centred 430 px column with a bottom nav.
// Desktop (lg, 1024 px and up): a fixed sidebar on the left and a wide content area.
export default function AppShell() {
  const user = useAuth(s => s.user);
  const tabs = user?.role === 'coordinator' ? coordinatorTabs : volunteerTabs;

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar tabs={tabs} user={user} />

      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-cream-100 shadow-[0_0_60px_-20px_rgb(87_58_40_/_0.35)] lg:ml-72 lg:max-w-none lg:shadow-none">
        <main className="w-full flex-1 px-4 pb-28 lg:mx-auto lg:max-w-6xl lg:px-10 lg:pb-16 lg:pt-8">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-cream-300/80 bg-cream-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Main"
      >
        <ul className="flex">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 pb-2.5 pt-3 text-[11px] font-medium transition-colors ${isActive ? 'text-saffron-500' : 'text-ink-500 hover:text-ink-800'}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={24} strokeWidth={isActive ? 2.4 : 1.8} fill={isActive && Icon === House ? 'currentColor' : 'none'} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Sidebar({ tabs, user }) {
  const navigate = useNavigate();
  const logout = useAuth(s => s.logout);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-cream-300/80 bg-cream-50 px-5 py-7 lg:flex">
      <div className="px-2"><Wordmark /></div>

      <nav className="mt-10 flex-1" aria-label="Main">
        <ul className="space-y-1">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors ${isActive
                    ? 'bg-saffron-100 text-saffron-700'
                    : 'text-ink-700 hover:bg-cream-200/70 hover:text-ink-900'}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="rounded-3xl bg-cream-100 p-3 ring-1 ring-cream-300/70">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink-900">{user?.name}</p>
            <p className="text-sm capitalize text-ink-500">{user?.role}</p>
          </div>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            aria-label="Switch user"
            title="Switch user"
            className="rounded-full p-2 text-ink-500 hover:bg-cream-200 hover:text-saffron-600"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
