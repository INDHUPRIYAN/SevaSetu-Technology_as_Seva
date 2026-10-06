import { Link } from 'react-router-dom';

// One filled (primary) button per screen; everything else is outline or text.
const variants = {
  primary: 'bg-saffron-500 text-white hover:bg-saffron-600',
  soft: 'border border-line bg-white text-ink-900 hover:bg-cream-100',
  secondary: 'border border-line bg-white text-ink-900 hover:bg-cream-100',
  outline: 'border border-line bg-transparent text-ink-900 hover:bg-white',
  ghost: 'bg-transparent text-ink-700 hover:bg-cream-200/60',
};

const sizes = {
  sm: 'h-10 px-4 text-[13px]',
  md: 'h-12 px-6 text-[15px]',
  lg: 'h-12 px-6 text-[15px]',
};

// <Button to="/x"> renders a link, otherwise a button
export default function Button({ to, variant = 'primary', size = 'md', block, className = '', children, ...props }) {
  const cls = [
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors',
    'disabled:opacity-45',
    variants[variant], sizes[size], block ? 'w-full' : '', className,
  ].join(' ');
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>;
  return <button type="button" className={cls} {...props}>{children}</button>;
}
