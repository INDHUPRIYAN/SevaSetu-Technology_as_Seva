// Small line icons for B's screens. Decorative unless given a `title`.
function Icon({ title, className = 'size-6', children, viewBox = '0 0 24 24', ...rest }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const ChevronRight = p => <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>;
export const ChevronLeft = p => <Icon {...p}><path d="m15 6-6 6 6 6" /></Icon>;
export const Close = p => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const Lock = p => (
  <Icon {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>
);
export const Mic = p => (
  <Icon {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Icon>
);
export const Stop = p => <Icon {...p}><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /></Icon>;
export const Warning = p => (
  <Icon {...p}><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4.5M12 17.5v.01" /></Icon>
);
export const Leaf = p => (
  <Icon {...p}><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" /><path d="M5 19 13 11" /></Icon>
);
export const Pen = p => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></Icon>;
export const Check = p => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;

// Open book with a small spark, as in the "Seva Wisdom for Today" card of the mockup
export const WisdomBook = p => (
  <Icon {...p}>
    <path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1V19c-3-1-6-1-9 1-3-2-6-2-9-1V5.5Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M12 6.5V20" />
    <path d="m7 9.5 1 1.5-1 1.5M16 9.5l1 1.5-1 1.5" />
  </Icon>
);

// Two pages side by side, for Then and Now
export const Pages = p => (
  <Icon {...p}><rect x="3" y="5" width="8" height="14" rx="1.5" /><rect x="13" y="5" width="8" height="14" rx="1.5" /></Icon>
);
