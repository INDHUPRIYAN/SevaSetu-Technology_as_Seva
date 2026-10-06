// Page title block shared by B's screens: optional back link, small label, serif title, one line under it.
import { Link } from 'react-router-dom';
import { ChevronLeft } from './icons';

export default function PageHeader({ back, eyebrow, title, subtitle, children }) {
  return (
    <header className="flex flex-col gap-1">
      {back && (
        <Link
          to={back.to}
          className="-ml-2 mb-1 inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-ember
            hover:bg-peach-soft"
        >
          <ChevronLeft className="size-4" /> {back.label}
        </Link>
      )}
      {eyebrow && <p className="text-sm font-semibold tracking-wide text-ember uppercase">{eyebrow}</p>}
      <h1 className="font-serif text-3xl leading-tight font-semibold text-ink @2xl:text-4xl">{title}</h1>
      {subtitle && <p className="text-base text-ink-soft">{subtitle}</p>}
      {children}
    </header>
  );
}
