// STAND-IN for A's Home: just enough of the mockup to see B's WisdomCard in place (tests U1, U2).
import { Link } from 'react-router-dom';
import { WisdomCard } from '../personBRoutes';
import { useAuth } from '../stand-ins/auth';
import { SEEDED_COMMITMENT } from './demoIds';

export default function Home() {
  const user = useAuth(s => s.user);
  return (
    <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pt-2 pb-8 lg:px-6">
      <section
        aria-label="Welcome"
        className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#FEE7C8] via-[#FCC88C] to-[#F59A45] px-6 py-8 @2xl:px-10 @2xl:py-12"
      >
        <span aria-hidden="true" className="absolute -top-16 -right-16 size-64 rounded-full bg-[#FFD27A]/60 blur-sm" />
        <blockquote className="relative max-w-md font-serif text-3xl leading-tight font-semibold text-ink @2xl:text-4xl">
          “They alone live who live for others.”
        </blockquote>
        <p className="relative mt-2 font-serif text-lg text-ink">— Swami Vivekananda</p>
      </section>

      <WisdomCard />

      {user?.role !== 'coordinator' && (
        <Link to="/my-seva" className="rounded-3xl border border-line bg-surface p-5 shadow-card hover:bg-peach-soft">
          <span className="block text-sm font-semibold text-ember">Continue your Seva</span>
          <span className="mt-1 block font-serif text-xl font-semibold">English Reading Support</span>
          <span className="block text-sm text-ink-soft">Government School, Kanchipuram</span>
        </Link>
      )}
      <p className="text-xs text-ink-soft" data-testid="home-loaded">Harness Home · commitment {SEEDED_COMMITMENT.slice(-2)}</p>
    </div>
  );
}
