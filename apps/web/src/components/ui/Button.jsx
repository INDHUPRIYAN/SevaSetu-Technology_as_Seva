import { Link } from 'react-router-dom';

const variants = {
  primary: 'bg-gradient-to-b from-saffron-500 to-saffron-600 text-white shadow-lift hover:from-saffron-600 hover:to-saffron-700',
  soft: 'bg-cream-50 text-saffron-600 ring-1 ring-cream-300 shadow-card hover:bg-saffron-50',
  secondary: 'bg-surface text-ember ring-1 ring-line hover:bg-peach-soft',
  outline: 'bg-transparent text-ink-800 ring-1 ring-cream-300 hover:bg-cream-50',
  ghost: 'bg-transparent text-saffron-600 hover:bg-saffron-50',
};

const sizes = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-6 text-base',
};

// <Button to="/x"> renders a link, otherwise a button
export default function Button({ to, variant = 'primary', size = 'md', block, className = '', children, ...props }) {
  const cls = [
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors',
    'disabled:opacity-45 disabled:shadow-none',
    variants[variant], sizes[size], block ? 'w-full' : '', className,
  ].join(' ');
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>;
  return <button type="button" className={cls} {...props}>{children}</button>;
}
