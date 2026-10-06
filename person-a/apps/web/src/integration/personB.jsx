// The ONLY file in Person A's app that knows about Person B's work.
// While B is parked, everything here is a stand-in. At integration, replace each
// stand-in with the real import (see docs/INTEGRATION.md) and delete nothing else.

// components/seva/WisdomCard — Home shows nothing until B's card exists
export function WisdomCard() {
  return null;
}

// components/seva/WhyLink — rule: 'no-hours' | 'listen-first' | 'no-photos' | 'no-ranks'
export function WhyLink({ rule }) {
  return null;
}

function ComingSoon({ title }) {
  return <p>{title} — coming soon.</p>;
}

// B's pages. routes.jsx maps over this list, so the paths are already final.
export const personBRoutes = [
  { path: '/wisdom', element: <ComingSoon title="Wisdom" /> },
  { path: '/reflect/:commitmentId', element: <ComingSoon title="Seva Diary" /> },
  { path: '/reflect/:commitmentId/then-and-now', element: <ComingSoon title="Then and Now" /> },
  { path: '/coordinator/post-need', element: <ComingSoon title="Post a Need" /> },
];
