// Small "Why?" text button. rule: 'no-hours' | 'listen-first' | 'no-photos' | 'no-ranks'
import { useState } from 'react';
import WhyModal from './WhyModal';

export default function WhyLink({ rule, children = 'Why?' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-11 items-center rounded-full px-2 text-sm font-semibold text-ember underline
          decoration-ember/40 underline-offset-4 hover:decoration-ember"
      >
        {children}
      </button>
      {open && <WhyModal rule={rule} onClose={() => setOpen(false)} />}
    </>
  );
}
