import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { initials } from '../../lib/format';
import { HillsScene } from './Art';

export function Avatar({ name, size = 'md', className = '' }) {
  const s = { sm: 'h-8 w-8 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-xl' }[size];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-saffron-300 to-saffron-500 font-semibold text-white ring-2 ring-cream-50 ${s} ${className}`}>
      {initials(name)}
    </span>
  );
}

// round peach badge holding an icon, like the tiles in the mockup
export function IconBadge({ icon: Icon, size = 'md', className = '' }) {
  const s = { sm: 'h-9 w-9', md: 'h-12 w-12', lg: 'h-14 w-14' }[size];
  const i = { sm: 18, md: 24, lg: 28 }[size];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-saffron-100 text-saffron-500 ${s} ${className}`}>
      <Icon size={i} strokeWidth={2.2} />
    </span>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 rounded-full px-4 text-sm font-medium transition ${active
        ? 'bg-saffron-500 text-white shadow-lift'
        : 'bg-cream-50 text-ink-700 ring-1 ring-cream-300 hover:ring-saffron-300'}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, max, className = '' }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-cream-300/70 ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full rounded-full bg-gradient-to-r from-saffron-400 to-saffron-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SectionTitle({ children, action, to }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="font-serif text-[22px] font-semibold text-ink-900">{children}</h2>
      {action && (
        <Link to={to} className="flex items-center text-sm font-medium text-saffron-600">
          {action}<ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

// title bar with a back button, for inner screens
export function PageHeader({ title, subtitle, back = true, right }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 bg-cream-100/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)] backdrop-blur lg:static lg:mx-0 lg:mb-8 lg:bg-transparent lg:px-0 lg:pt-0 lg:backdrop-blur-none">
      {back && (
        <button onClick={() => navigate(-1)} aria-label="Back" className="-ml-2 rounded-full p-2 text-ink-700 hover:bg-cream-200">
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-serif text-[22px] font-semibold leading-tight text-ink-900 lg:text-[34px]">{title}</h1>
        {subtitle && <p className="truncate text-sm text-ink-500 lg:mt-1 lg:text-base">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-ink-500" role="status">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-saffron-200 border-t-saffron-500" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-saffron-50 p-4 text-sm text-saffron-700 ring-1 ring-saffron-200" role="alert">
      <span className="flex-1">{error.message || String(error)}</span>
      {onRetry && (
        <button onClick={() => onRetry()} className="flex items-center gap-1 font-semibold">
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-cream-50 px-6 pb-6 pt-2 text-center ring-1 ring-cream-300/70">
      <HillsScene className="h-24 w-48" />
      <h3 className="mt-1 font-serif text-lg font-semibold text-ink-900">{title}</h3>
      {children && <p className="mt-1 text-sm leading-relaxed text-ink-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const pill = {
  served: 'bg-saffron-100 text-saffron-700',
  covered: 'bg-amber-100 text-amber-800',
  gap: 'bg-cream-200 text-ink-500',
  upcoming: 'bg-cream-50 text-ink-500 ring-1 ring-cream-300',
  open: 'bg-emerald-50 text-emerald-700',
  filled: 'bg-saffron-100 text-saffron-700',
  requested: 'bg-cream-200 text-ink-700',
  visited: 'bg-amber-100 text-amber-800',
  agreed: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-cream-200 text-ink-500',
  active: 'bg-emerald-50 text-emerald-700',
  paused: 'bg-cream-200 text-ink-700',
  finished: 'bg-saffron-100 text-saffron-700',
  matched: 'bg-amber-100 text-amber-800',
  'handed-over': 'bg-emerald-50 text-emerald-700',
};

const label = { gap: 'cannot come', requested: 'visit requested', visited: 'visited', 'handed-over': 'handed over' };

export function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${pill[status] || pill.upcoming}`}>
      {label[status] || status}
    </span>
  );
}

export function TextArea({ label: text, hint, ...props }) {
  return (
    <label className="block">
      {text && <span className="mb-2 block font-serif text-lg font-semibold text-ink-900">{text}</span>}
      {hint && <span className="-mt-1 mb-2 block text-sm text-ink-500">{hint}</span>}
      <textarea
        rows={4}
        className="w-full resize-none rounded-2xl bg-cream-50 p-4 text-[15px] leading-relaxed text-ink-800 ring-1 ring-cream-300 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-saffron-400"
        {...props}
      />
    </label>
  );
}
