import { useParams } from 'react-router-dom';
import { BadgeCheck, CalendarDays, Ear, HeartHandshake, MapPin, Sprout, Target, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useLoad } from '../lib/useLoad';
import { rhythm } from '../lib/format';
import { ErrorNote, IconBadge, Loading, PageHeader, StatusPill } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WhyLink from '../components/seva/WhyLink';

export default function NeedDetail() {
  const { id } = useParams();
  const need = useLoad(() => api.get(`/api/needs/${id}`), [id]);
  const visits = useLoad(() => api.get('/api/visits/mine'));
  const myVisit = visits.data?.find(v => v.needId === id);

  if (need.loading) return <><PageHeader title="" /><Loading /></>;
  if (need.error) return <><PageHeader title="Need" /><ErrorNote error={need.error} onRetry={need.reload} /></>;
  const n = need.data;

  const parts = [
    { icon: Target, title: 'What we want', text: n.want },
    { icon: HeartHandshake, title: 'How to serve us well', text: n.serveUsWell },
    { icon: Sprout, title: 'What you will learn', text: n.youWillLearn },
  ];

  const canListen = n.status === 'open' || myVisit;

  // the only action: listen first. There is no "Register" anywhere.
  const action = canListen ? (
    <Button to={`/needs/${id}/listen`} block size="lg">
      <Ear size={20} /> {myVisit ? 'Continue listening' : 'Visit and listen'}
    </Button>
  ) : (
    <p className="rounded-full bg-cream-50 py-3 text-center text-sm text-ink-500 ring-1 ring-cream-300">Another volunteer is already serving here.</p>
  );

  return (
    <div className="pb-24 lg:pb-0">
      <PageHeader title={n.title} subtitle={n.org.name} />

      <div className="lg:flex lg:flex-col lg:gap-6 xl:grid xl:grid-cols-[1fr_340px] xl:items-start xl:gap-8">
        <div className="space-y-3 lg:space-y-4">
          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            {n.verified && <Verified />}
            {n.status !== 'open' && <StatusPill status={n.status} />}
          </div>

          {parts.map(p => (
            <Card key={p.title} className="flex gap-3.5 p-4 lg:gap-5 lg:p-6">
              <IconBadge icon={p.icon} size="sm" className="lg:h-12 lg:w-12" />
              <div>
                <h2 className="font-serif text-[17px] font-semibold text-ink-900 lg:text-xl">{p.title}</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-700 lg:mt-2 lg:text-base">{p.text || '—'}</p>
              </div>
            </Card>
          ))}

          <Card className="flex gap-3.5 p-4 lg:gap-5 lg:p-6">
            <IconBadge icon={CalendarDays} size="sm" className="lg:h-12 lg:w-12" />
            <div className="space-y-1.5 text-[15px] text-ink-700 lg:text-base">
              <h2 className="font-serif text-[17px] font-semibold text-ink-900 lg:text-xl">Rhythm</h2>
              <p>{rhythm(n.rhythm)}, for {n.weeks} weeks</p>
              <p className="flex items-start gap-1.5"><MapPin size={16} className="mt-1 shrink-0 text-ink-500" />{n.place}{n.org.distanceKm != null && ` · ${n.org.distanceKm} km`}</p>
              {n.groupSize && <p className="flex items-center gap-1.5"><Users size={16} className="text-ink-500" />A group of {n.groupSize}</p>}
            </div>
          </Card>

          {n.handover?.note && (
            <Card className="flex gap-3.5 p-4 lg:gap-5 lg:p-6">
              <IconBadge icon={HeartHandshake} size="sm" className="lg:h-12 lg:w-12" />
              <div>
                <h2 className="font-serif text-[17px] font-semibold text-ink-900 lg:text-xl">From the volunteer before you</h2>
                <p className="mt-1 font-serif text-[15px] italic leading-relaxed text-ink-700 lg:mt-2 lg:text-base">“{n.handover.note}”</p>
              </div>
            </Card>
          )}
        </div>

        {/* desktop: a sticky panel beside the card */}
        <Card className="hidden p-6 lg:order-first lg:block xl:sticky xl:top-8 xl:order-none">
          <div className="flex flex-wrap items-center gap-2">
            {n.verified && <Verified />}
            {n.status !== 'open' && <StatusPill status={n.status} />}
          </div>
          <p className="mt-4 font-serif text-xl font-semibold text-ink-900">{n.org.name}</p>
          <p className="mt-1 text-sm text-ink-500">{rhythm(n.rhythm)}</p>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-700">
            Before anyone commits, you visit once — only to listen. Then you and the community each say yes or no.
          </p>
          <div className="mt-6">{action}</div>
          <div className="mt-3 text-center"><WhyLink rule="listen-first" /></div>
        </Card>
      </div>

      {/* phone: a bar above the bottom nav */}
      <div className="fixed bottom-[76px] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 bg-gradient-to-t from-cream-100 via-cream-100/95 to-transparent px-4 pb-3 pt-6 lg:hidden">
        {action}
        <div className="mt-2 text-center"><WhyLink rule="listen-first" /></div>
      </div>
    </div>
  );
}

function Verified() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-saffron-100 px-3 py-1 text-xs font-semibold text-saffron-700">
      <BadgeCheck size={14} /> Verified
    </span>
  );
}
