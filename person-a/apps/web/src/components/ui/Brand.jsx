import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Lotus } from './Art';
import { Avatar } from './Bits';
import { useAuth } from '../../lib/auth';

export function Wordmark({ size = 'md' }) {
  const big = size === 'lg';
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <Lotus className={big ? 'h-16 w-16' : 'h-12 w-12'} />
      <div className="whitespace-nowrap leading-none">
        <div className={`font-serif font-bold tracking-tight ${big ? 'text-[38px]' : 'text-[30px]'}`}>
          <span className="text-saffron-600">Seva</span><span className="text-ink-900">Setu</span>
        </div>
        <div className={`mt-1 text-ink-700 ${big ? 'text-base' : 'text-[13px]'}`}>Serve • Learn • Grow</div>
      </div>
    </div>
  );
}

// top bar of Home and the dashboard: wordmark, city, avatar.
// On desktop the sidebar already shows the wordmark, so a greeting takes its place.
export function TopBar() {
  const user = useAuth(s => s.user);
  return (
    <div className="flex items-center justify-between gap-2 pt-[max(env(safe-area-inset-top),16px)] lg:pt-0">
      <div className="lg:hidden"><Wordmark /></div>
      <p className="hidden text-[15px] font-medium text-ink-800 lg:block">
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <div className="flex min-w-0 items-center gap-2">
        {user?.city && (
          <span className="flex h-10 min-w-0 items-center gap-1.5 rounded-full bg-cream-50/90 px-3 text-sm font-medium text-ink-800 shadow-card">
            <MapPin size={16} className="shrink-0 text-saffron-500" fill="currentColor" stroke="#FFFCF8" />
            <span className="truncate">{user.city}</span>
          </span>
        )}
        <Link to="/profile" aria-label="Profile" className="shrink-0">
          <Avatar name={user?.name} />
        </Link>
      </div>
    </div>
  );
}
