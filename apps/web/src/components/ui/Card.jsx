import { Link } from 'react-router-dom';

// Every card: white, 16px round, 1px soft border, a very light shadow. <Card to="/x"> is a tappable card.
export default function Card({ to, className = '', children, ...props }) {
  const cls = `block rounded-2xl border border-line bg-white shadow-card ${to ? 'transition-colors hover:border-saffron-200' : ''} ${className}`;
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>;
  return <div className={cls} {...props}>{children}</div>;
}
