// Lotus mark + wordmark, after the mockup header.
export function Lotus({ className = 'size-11' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#FDE5CB" />
      <g fill="#E14D04">
        <path d="M24 10c4 5 4 13 0 20-4-7-4-15 0-20Z" />
        <path d="M13 17c6 1 10 7 10.5 13.5C17 29 13 24 13 17Z" opacity=".85" />
        <path d="M35 17c-6 1-10 7-10.5 13.5C31 29 35 24 35 17Z" opacity=".85" />
        <path d="M9 27c5-1 10 2 14 6-6 1-11-1-14-6ZM39 27c-5-1-10 2-14 6 6 1 11-1 14-6Z" opacity=".7" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Lotus />
      <span className="leading-none">
        <span className="block font-serif text-2xl font-bold text-ember">Seva<span className="text-ink">Setu</span></span>
        <span className="mt-1 block text-xs tracking-wide text-ink-soft">Serve • Learn • Grow</span>
      </span>
    </span>
  );
}
