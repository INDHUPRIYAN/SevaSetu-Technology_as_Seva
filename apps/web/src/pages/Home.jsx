// Home: one teaching, one main action ("Find a Need"), and the seva she is keeping. No carousel, no photos.
import { CalendarDays, ChevronRight, MapPin, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { firstName, rhythm } from '../lib/format';
import { TopBar } from '../components/ui/Brand';
import { SchoolScene } from '../components/ui/Art';
import { EmptyState, ProgressBar, SectionTitle, Skeleton } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WisdomCard from '../components/seva/WisdomCard';

export default function Home() {
  const user = useAuth(s => s.user);
  const commitments = useLoad(() => api.get('/api/commitments/mine'));
  const active = commitments.data?.find(c => c.status === 'active') || commitments.data?.[0];

  return (
    <div className="space-y-6 pb-4 lg:max-w-3xl">
      <TopBar />

      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Vanakkam, {firstName(user?.name) || 'friend'}</h1>
        <p className="mt-1 text-[15px] text-ink-700">Find one need, listen first, and keep showing up.</p>
      </header>

      <WisdomCard plain />

      <Button to="/opportunities" block size="lg">
        <Search /> Find a Need
      </Button>

      <section>
        <SectionTitle action={active ? 'My Seva' : undefined} to="/my-seva">Continue Your Seva</SectionTitle>
        {commitments.loading ? (
          <Skeleton className="h-32" />
        ) : active ? (
          <ContinueCard c={active} />
        ) : (
          <EmptyState title="Your seva will wait here" action={<Button to="/opportunities" variant="outline" size="sm">See needs near you</Button>}>
            Visit once to listen. If the community invites you back, your weeks will show here.
          </EmptyState>
        )}
      </section>
    </div>
  );
}

function ContinueCard({ c }) {
  return (
    <Card to="/my-seva" className="flex items-stretch overflow-hidden">
      <SchoolScene className="w-[32%] shrink-0" />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-[15px] font-semibold text-saffron-600">Week {c.currentWeek} of {c.weeks}</span>
          <ProgressBar value={c.currentWeek} max={c.weeks} className="flex-1" />
        </div>
        <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-ink-900">{c.need.title}</h3>
        <p className="mt-1 flex items-start gap-1.5 text-[13px] text-ink-700">
          <MapPin className="mt-0.5 shrink-0 text-ink-500" /> {c.need.place}
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-[13px] text-ink-700">
          <CalendarDays className="mt-0.5 shrink-0 text-ink-500" /> {rhythm(c.need.rhythm)}
        </p>
      </div>
      <ChevronRight className="mr-2 self-center text-ink-500" />
    </Card>
  );
}
