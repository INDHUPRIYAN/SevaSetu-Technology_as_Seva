// The ONLY file in Person A's app that knows about Person B's work.
// While B is parked, everything here is a stand-in. At integration, replace each
// stand-in with the real import (see docs/INTEGRATION.md) and delete nothing else.
import { PageHeader, EmptyState } from '../components/ui/Bits';

// components/seva/WisdomCard — Home shows nothing until B's card exists
export function WisdomCard() {
  return null;
}

// components/seva/WhyLink — rule: 'no-hours' | 'listen-first' | 'no-photos' | 'no-ranks'
export function WhyLink({ rule }) {
  return null;
}

function ComingSoon({ title }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title="Coming soon">This part of SevaSetu is being built.</EmptyState>
    </>
  );
}

// B's pages. routes.jsx mounts these inside the app shell, so the paths are already final.
// `role` limits a page to one role, like A's own routes.
export const personBRoutes = [
  { path: '/wisdom', element: <ComingSoon title="Wisdom" /> },
  { path: '/reflect/:commitmentId', element: <ComingSoon title="Seva Diary" />, role: 'volunteer' },
  { path: '/reflect/:commitmentId/then-and-now', element: <ComingSoon title="Then and Now" />, role: 'volunteer' },
  { path: '/coordinator/post-need', element: <ComingSoon title="Post a Need" />, role: 'coordinator' },
];
