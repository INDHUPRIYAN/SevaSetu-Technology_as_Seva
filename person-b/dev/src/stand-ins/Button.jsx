// STAND-IN for Person A's components/ui/Button. B relies on `variant` ('primary' | 'secondary'),
// `type`, `disabled`, `onClick`, `className` and `children`; any other prop goes to the <button>.
const VARIANTS = {
  primary: 'bg-saffron-strong text-white shadow-pill hover:bg-saffron-deep active:bg-saffron-deep',
  secondary: 'border border-line bg-surface text-ember hover:bg-peach-soft',
};

export default function Button({ variant = 'primary', type = 'button', className = '', children, ...rest }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold
        transition-colors disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
