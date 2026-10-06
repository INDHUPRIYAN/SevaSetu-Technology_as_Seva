// Illustrations drawn in SVG. On purpose, none of them shows a person:
// SevaSetu never shows photos or likenesses of the people served.

export function Lotus({ className = 'h-12 w-12' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lotus-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F28A45" />
          <stop offset="1" stopColor="#D04A0A" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#FDE8D7" />
      <g fill="url(#lotus-g)">
        <path d="M32 11c5.5 6 7.5 13 7.5 19.5S36.5 42 32 45.5c-4.5-3.5-7.5-8.5-7.5-15S26.5 17 32 11z" />
        <path d="M13 25c7.5 1 13.5 5 16.5 10.5s3 10.5 2 13.5c-5.5 0-11.5-2.5-14.5-7.5S13 30.5 13 25z" opacity=".85" />
        <path d="M51 25c-7.5 1-13.5 5-16.5 10.5s-3 10.5-2 13.5c5.5 0 11.5-2.5 14.5-7.5S51 30.5 51 25z" opacity=".85" />
      </g>
      <path d="M15 49c5 2 11 3 17 3s12-1 17-3" stroke="#A93A0B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// sunrise over hills with a temple and birds, for the Home and Login heroes.
// Full-bleed: place it `absolute inset-0`. The sun and temple sit on the right, the text column
// on the left stays clear, and the hills run the full width along the bottom.
export function HeroScene({ className = '', birdsClassName = '' }) {
  return (
    <svg viewBox="0 0 390 420" className={className} aria-hidden="true" preserveAspectRatio="xMaxYMax slice">
      <defs>
        <radialGradient id="sun-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF4D8" />
          <stop offset="0.45" stopColor="#FFD796" stopOpacity="0.9" />
          <stop offset="1" stopColor="#F6A65A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hill-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2A160" />
          <stop offset="1" stopColor="#EC8F4B" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="hill-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E07636" />
          <stop offset="1" stopColor="#E9925A" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="hill-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDF7EE" stopOpacity="0" />
          <stop offset="1" stopColor="#FDF7EE" />
        </linearGradient>
      </defs>

      <circle cx="300" cy="210" r="150" fill="url(#sun-glow)" />
      <circle cx="300" cy="210" r="58" fill="#FFE6B3" />

      <g fill="none" stroke="#B9521C" strokeWidth="1.8" strokeLinecap="round" opacity=".8" className={birdsClassName}>
        <path d="M228 118q5-5 10 0q5-5 10 0" />
        <path d="M262 96q4-4 8 0q4-4 8 0" />
        <path d="M352 132q3.5-3.5 7 0q3.5-3.5 7 0" />
        <path d="M244 148q3-3 6 0q3-3 6 0" opacity=".7" />
      </g>

      <path d="M0 330 Q70 296 140 312 T270 284 T390 290 V420 H0Z" fill="url(#hill-far)" />

      {/* temple on the far hill */}
      <g fill="#C55C22">
        <rect x="292" y="252" width="56" height="34" rx="2" />
        <path d="M297 252 Q320 212 343 252Z" />
        <rect x="318.5" y="198" width="3" height="20" />
        <circle cx="320" cy="197" r="3.5" />
        <rect x="280" y="266" width="13" height="20" />
        <path d="M280 266 Q286.5 252 293 266Z" />
        <rect x="347" y="266" width="13" height="20" />
        <path d="M347 266 Q353.5 252 360 266Z" />
        <rect x="312" y="270" width="16" height="16" fill="#A94A17" />
      </g>

      <path d="M0 352 Q90 318 180 340 T390 322 V420 H0Z" fill="url(#hill-mid)" />
      <g fill="#B9521C" opacity=".85">
        <path d="M232 334c0-14 7-25 11-25s11 11 11 25z" />
        <rect x="241.5" y="332" width="3" height="11" />
        <path d="M372 324c0-12 6-21 9-21s9 9 9 21z" />
        <rect x="379.5" y="322" width="3" height="10" />
      </g>
      <rect y="330" width="390" height="90" fill="url(#hill-fade)" />
    </svg>
  );
}

// a schoolhouse with an open book, for a seva card thumbnail
export function SchoolScene({ className = '' }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD9A8" />
          <stop offset="1" stopColor="#FCEBD3" />
        </linearGradient>
      </defs>
      <rect width="160" height="120" fill="url(#sky-g)" />
      <circle cx="122" cy="30" r="14" fill="#FFF1CF" />
      <path d="M0 92 Q40 78 80 88 T160 84 V120 H0Z" fill="#F2B27A" />
      <g>
        <rect x="34" y="52" width="62" height="38" fill="#FBEBDD" stroke="#C55C22" strokeWidth="1.5" />
        <path d="M28 54 L65 30 L102 54Z" fill="#E8590C" />
        <rect x="58" y="68" width="14" height="22" fill="#C55C22" />
        <rect x="40" y="60" width="11" height="9" fill="#F8B27F" />
        <rect x="79" y="60" width="11" height="9" fill="#F8B27F" />
        <rect x="64" y="22" width="2" height="12" fill="#A93A0B" />
        <path d="M66 22 h11 l-3 3 l3 3 h-11z" fill="#E8590C" />
      </g>
      <g transform="translate(100 82)">
        <path d="M0 8 Q14 0 28 8 V30 Q14 22 0 30Z" fill="#FFFCF8" stroke="#A93A0B" strokeWidth="1.3" />
        <path d="M28 8 Q42 0 56 8 V30 Q42 22 28 30Z" fill="#FFFCF8" stroke="#A93A0B" strokeWidth="1.3" />
        <path d="M6 13 q8-4 16 0 M6 18 q8-4 16 0 M34 13 q8-4 16 0 M34 18 q8-4 16 0" stroke="#F28A45" strokeWidth="1.1" fill="none" />
      </g>
      <g fill="#C55C22" opacity=".8">
        <path d="M12 92c0-10 5-17 8-17s8 7 8 17z" />
        <rect x="18.5" y="90" width="3" height="8" />
      </g>
    </svg>
  );
}

// soft hills only, for empty states
export function HillsScene({ className = '' }) {
  return (
    <svg viewBox="0 0 200 90" className={className} aria-hidden="true">
      <circle cx="100" cy="58" r="30" fill="#FFE2A8" />
      <path d="M0 70 Q50 44 100 62 T200 56 V90 H0Z" fill="#F8B27F" />
      <path d="M0 80 Q60 62 120 76 T200 72 V90 H0Z" fill="#F28A45" />
      <g fill="none" stroke="#C55C22" strokeWidth="1.5" strokeLinecap="round">
        <path d="M60 24q4-4 8 0q4-4 8 0" />
        <path d="M128 18q3-3 6 0q3-3 6 0" />
      </g>
    </svg>
  );
}
