// STAND-IN for A's Need detail and guest briefing, where A places B's WhyLink (test U4).
import { WhyLink } from '../personBRoutes';

export default function NeedDetail() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4 pb-8 lg:px-6">
      <h1 className="font-serif text-3xl font-semibold">English Reading Support</h1>
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="font-semibold">Visit and listen first</h2>
        <p className="mt-1 text-ink-soft">Before you serve, you visit once and listen. <WhyLink rule="listen-first" /></p>
      </section>
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="font-semibold">Guest briefing</h2>
        <p className="mt-1 text-ink-soft">Please do not take photos. <WhyLink rule="no-photos" /></p>
      </section>
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="font-semibold">Your circle</h2>
        <p className="mt-1 text-ink-soft">No leaderboard here. <WhyLink rule="no-ranks" /></p>
      </section>
    </div>
  );
}
