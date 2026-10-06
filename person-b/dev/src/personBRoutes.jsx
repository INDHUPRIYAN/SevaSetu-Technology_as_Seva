// What A's apps/web/src/integration/personB.jsx becomes at integration (see person-b/docs/HANDOVER.md).
// Only the import paths differ there ('../pages/Diary' instead of '../../apps/web/src/pages/Diary').
import Wisdom from '../../apps/web/src/pages/Wisdom';
import Diary from '../../apps/web/src/pages/Diary';
import ThenAndNow from '../../apps/web/src/pages/ThenAndNow';
import PostNeed from '../../apps/web/src/pages/PostNeed';

export { default as WisdomCard } from '../../apps/web/src/components/seva/WisdomCard';
export { default as WhyLink } from '../../apps/web/src/components/seva/WhyLink';

export const personBRoutes = [
  { path: '/wisdom', element: <Wisdom /> },
  { path: '/reflect/:commitmentId', element: <Diary /> },
  { path: '/reflect/:commitmentId/then-and-now', element: <ThenAndNow /> },
  { path: '/coordinator/post-need', element: <PostNeed /> },
];
