import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, ChevronRight, Compass, Ear, Handshake, MapPin, Repeat, Search, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { rhythm } from '../lib/format';
import { TopBar } from '../components/ui/Brand';
import { HeroScene, SchoolScene } from '../components/ui/Art';
import { EmptyState, IconBadge, ProgressBar, SectionTitle } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WisdomCard from '../components/seva/WisdomCard';

// Only the first slide is a quote. The others are SevaSetu's own words, so nothing is misattributed.
const slides = [
  { quote: 'They alone live who live for others.', by: 'Swami Vivekananda', body: 'Give a little time, every week, to people near you — and listen first.' },
  { title: 'Listen before you serve.', body: 'Every seva begins with a visit, to hear what the community actually wants.' },
  { title: 'Small seva, every week.', body: 'Four weeks, one rhythm, and a circle of friends who cover for each other.' },
];

const journey = [
  { icon: Search, title: 'Find', text: 'Answer three questions. See at most three needs that fit.' },
  { icon: Ear, title: 'Listen', text: 'Visit once, only to listen. Write what surprised you.' },
  { icon: Handshake, title: 'Commit', text: 'When you and the community both say yes, give four weeks.' },
  { icon: Repeat, title: 'Continue', text: 'The community invites you back. You choose what comes next.' },
];

export default function Home() {
  const user = useAuth(s => s.user);
  const commitments = useLoad(() => api.get('/api/commitments/mine'));
  const active = commitments.data?.find(c => c.status === 'active') || commitments.data?.[0];

  const tiles = [
    { icon: Search, title: 'Find a Need', text: 'Based on your interest & availability', to: '/opportunities' },
    { icon: Ear, title: 'Listen First', text: 'Understand before you serve', to: '/my-seva#listening' },
    { icon: Users, title: 'Join a Circle', text: 'Serve as a team', to: '/my-seva#circle' },
    { icon: BookOpen, title: 'Reflect & Grow', text: 'Your private Seva diary', to: active ? `/reflect/${active._id}` : '/my-seva' },
  ];

  return (
    <div className="-mx-4 lg:mx-0">
      <Hero />

      <div className="relative z-10 -mt-12 space-y-4 px-4 lg:-mt-14 lg:space-y-8 lg:px-0">
        <Card className="animate-rise p-4 lg:mx-8 lg:flex lg:items-center lg:gap-6 lg:p-6">
          <div className="flex flex-1 items-start gap-3.5 lg:items-center lg:gap-5">
            <IconBadge icon={Compass} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-[21px] font-semibold leading-snug text-ink-900 lg:text-[26px]">Begin Your Seva Journey</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-700 lg:text-base">
                Discover opportunities, meet communities and grow through service.
              </p>
            </div>
          </div>
          <Button to="/opportunities" block size="md" className="mt-4 lg:mt-0 lg:h-13 lg:w-auto lg:shrink-0 lg:px-8 lg:text-base">
            Find Opportunities <ChevronRight size={18} />
          </Button>
        </Card>

        <div className="grid grid-cols-4 gap-2 rounded-3xl bg-cream-50/60 p-2 ring-1 ring-cream-300/50 lg:gap-5 lg:bg-transparent lg:p-0 lg:ring-0">
          {tiles.map(t => (
            <Card key={t.title} to={t.to} className="flex flex-col items-center px-1.5 pb-3 pt-3.5 text-center lg:px-5 lg:py-7">
              <IconBadge icon={t.icon} className="lg:h-14 lg:w-14" />
              <span className="mt-2 text-[13px] font-semibold leading-tight text-ink-900 lg:mt-3 lg:text-[17px]">{t.title}</span>
              <span className="mt-1 text-[11px] leading-snug text-ink-500 lg:text-sm">{t.text}</span>
            </Card>
          ))}
        </div>

        <div className="space-y-4 lg:grid lg:grid-cols-5 lg:items-start lg:gap-8 lg:space-y-0">
          <section className="pt-2 lg:col-span-3 lg:pt-0">
            <SectionTitle action="View All" to="/my-seva">Continue Your Seva</SectionTitle>
            {commitments.loading ? (
              <div className="h-32 animate-pulse rounded-3xl bg-cream-50 lg:h-48" />
            ) : active ? (
              <ContinueCard c={active} />
            ) : (
              <EmptyState
                title={`Welcome, ${user?.name?.split(' ')[0] || 'friend'}`}
                action={<Button to="/opportunities" size="sm">Find your first seva</Button>}
              >
                When you commit to a seva, it will show here, week by week.
              </EmptyState>
            )}
          </section>

          <div className="space-y-4 lg:col-span-2 lg:space-y-6">
            <WisdomCard />
            <Card className="hidden p-6 lg:block">
              <h2 className="font-serif text-xl font-semibold text-ink-900">How SevaSetu works</h2>
              <ol className="mt-5 space-y-5">
                {journey.map((j, n) => (
                  <li key={j.title} className="flex gap-4">
                    <IconBadge icon={j.icon} size="sm" />
                    <div>
                      <p className="font-semibold text-ink-900">{n + 1}. {j.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-700">{j.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(n => (n + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, []);
  const s = slides[i];

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#F6A65A] via-[#F9C88F] to-cream-100 px-4 pb-24 lg:rounded-[2rem] lg:bg-gradient-to-r lg:from-[#F6A65A] lg:via-[#F8BC7C] lg:to-[#FBD9AE] lg:px-12 lg:pb-28 lg:pt-8">
      <HeroScene className="pointer-events-none absolute inset-0 h-full w-full lg:left-auto lg:w-[62%] lg:[mask-image:linear-gradient(to_right,transparent,black_35%)]" />
      <div className="relative">
        <TopBar />
        <div key={i} className="mt-8 max-w-[16rem] animate-rise lg:mt-10 lg:max-w-xl" aria-live="polite">
          {s.quote ? (
            <>
              <p className="font-serif text-[31px] font-semibold leading-[1.15] text-ink-900 lg:text-[54px]">
                <span className="-ml-3 lg:-ml-5">“</span>{s.quote}”
              </p>
              <p className="mt-3 font-serif text-lg font-semibold text-ink-900 lg:mt-5 lg:text-2xl">— {s.by}</p>
            </>
          ) : (
            <p className="font-serif text-[31px] font-semibold leading-[1.15] text-ink-900 lg:text-[54px]">{s.title}</p>
          )}
          <p className="mt-3 text-[15px] leading-relaxed text-ink-800 lg:mt-5 lg:max-w-md lg:text-lg">{s.body}</p>
        </div>
        <div className="mt-5 flex gap-2 lg:mt-8" role="tablist" aria-label="Slides">
          {slides.map((_, n) => (
            <button
              key={n}
              role="tab"
              aria-selected={n === i}
              aria-label={`Slide ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-2 rounded-full transition-all ${n === i ? 'w-5 bg-saffron-500' : 'w-2 bg-cream-50/90'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ContinueCard({ c }) {
  return (
    <Card to="/my-seva" className="flex items-stretch overflow-hidden">
      <SchoolScene className="w-[38%] shrink-0 lg:min-h-52" />
      <div className="min-w-0 flex-1 p-3.5 lg:p-6">
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-sm font-semibold text-saffron-600 lg:text-base">Week {c.currentWeek} of {c.weeks}</span>
          <ProgressBar value={c.currentWeek} max={c.weeks} className="flex-1" />
        </div>
        <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-ink-900 lg:mt-3 lg:text-2xl">{c.need.title}</h3>
        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-ink-700 lg:mt-3 lg:text-[15px]">
          <MapPin size={15} className="mt-0.5 shrink-0 text-ink-500" /> {c.need.place}
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-[13px] text-ink-700 lg:text-[15px]">
          <CalendarDays size={15} className="mt-0.5 shrink-0 text-ink-500" /> {rhythm(c.need.rhythm)}
        </p>
      </div>
      <ChevronRight className="mr-2 self-center text-saffron-500 lg:mr-5" size={22} />
    </Card>
  );
}
