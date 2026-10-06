// STAND-IN for Person A's components/ui/Card. B only relies on `className` and `children`.
export default function Card({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-3xl border border-line bg-surface shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}
