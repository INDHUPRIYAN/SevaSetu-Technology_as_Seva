import { Link } from 'react-router-dom';

// <Card to="/x"> is a tappable card
export default function Card({ to, className = '', children, ...props }) {
  const cls = `block rounded-3xl bg-cream-50 ring-1 ring-cream-300/70 shadow-card ${to ? 'transition hover:ring-saffron-200 active:scale-[0.99]' : ''} ${className}`;
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>;
  return <div className={cls} {...props}>{children}</div>;
}
