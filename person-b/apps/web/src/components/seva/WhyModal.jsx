// The teaching behind one rule of the app (endpoint 27). Close button, tap outside and Esc all close it.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import Button from '../ui/Button';
import { Close } from './icons';

export default function WhyModal({ rule, onClose }) {
  const [state, setState] = useState({ status: 'loading' });
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    api.get(`/api/wisdom/why/${encodeURIComponent(rule)}`)
      .then(why => alive && setState({ status: 'ready', why }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => { alive = false; };
  }, [rule]);

  // focus the close button, keep Tab inside the dialog, Esc closes, the page behind does not scroll
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  const title = state.status === 'ready' ? state.why.title : 'Why?';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="why-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="why-title"
        aria-describedby="why-teaching"
        className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 pb-8
          shadow-card sm:max-w-md sm:rounded-3xl sm:pb-6"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-ink-soft hover:bg-peach-soft"
        >
          <Close className="size-5" />
        </button>

        <h2 id="why-title" className="pr-10 font-serif text-2xl font-semibold text-ink">{title}</h2>
        <div id="why-teaching" className="mt-3 text-base leading-relaxed text-ink-soft" aria-live="polite">
          {state.status === 'loading' && <p>Opening the teaching…</p>}
          {state.status === 'error' && <p>This teaching could not be opened just now. Please try again later.</p>}
          {state.status === 'ready' && <p className="whitespace-pre-line">{state.why.teaching}</p>}
        </div>

        <Button variant="secondary" onClick={onClose} className="mt-6 w-full">Close</Button>
      </div>
    </div>,
    document.body,
  );
}
