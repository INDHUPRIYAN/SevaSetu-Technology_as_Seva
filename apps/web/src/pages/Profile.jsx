import { useNavigate } from 'react-router-dom';
import { CameraOff, Ear, Footprints, HandHeart, Lock, LogOut, MapPin, Repeat, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { Avatar, PageHeader } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import WhyLink from '../components/seva/WhyLink';

const CONDUCT = [
  { icon: Footprints, text: 'We go as guests. The community is the host.' },
  { icon: Ear, text: 'We listen first, and serve what was asked for.', why: 'listen-first' },
  { icon: CameraOff, text: 'We take no photos of the people we serve.', why: 'no-photos' },
  { icon: HandHeart, text: 'We keep our weeks. Nobody is compared or scored.', why: 'no-ranks' },
  { icon: Users, text: 'If we cannot come, we tell our circle early.' },
];

// "My Seva so far": across every commitment, her first words beside her latest, and every Sankalpa in the
// order it was sealed. Only her own (reflect filters by her id). No counts, no totals, nothing to compare.
function MySevaSoFar() {
  const so = useLoad(() => api.get('/api/reflect/my-seva'));
  const d = so.data;
  if (!d || (!d.first && !d.sankalpas?.length)) return null;
  return (
    <Card className="p-4 lg:col-start-1 lg:p-6" data-testid="my-seva-so-far">
      <h3 className="font-serif text-xl font-semibold text-ink-900">My Seva so far</h3>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500"><Lock size={14} /> Only you can see this.</p>
      {d.first && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <figure className="rounded-2xl bg-cream-100 px-4 py-3">
            <figcaption className="text-xs font-semibold uppercase tracking-wider text-saffron-700">Your first words</figcaption>
            <blockquote className="mt-1 font-serif text-[17px] italic leading-snug text-ink-900">“{d.first.text}”</blockquote>
          </figure>
          {d.latest && (
            <figure className="rounded-2xl bg-white px-4 py-3 ring-1 ring-cream-300">
              <figcaption className="text-xs font-semibold uppercase tracking-wider text-saffron-700">Your latest words</figcaption>
              <blockquote className="mt-1 font-serif text-[17px] italic leading-snug text-ink-900">“{d.latest.text}”</blockquote>
            </figure>
          )}
        </div>
      )}
      {d.sankalpas?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">What you hoped to learn, each time</p>
          <ol className="mt-2 space-y-2">
            {d.sankalpas.map(x => (
              <li key={x.commitmentId} className="border-l-2 border-saffron-300 pl-3 font-serif italic text-ink-800">“{x.text}”</li>
            ))}
          </ol>
        </div>
      )}
      {d.received?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">What they gave you</p>
          <ol className="mt-2 space-y-2">
            {d.received.map(x => (
              <li key={x.commitmentId} className="border-l-2 border-cream-300 pl-3 font-serif italic text-ink-800">“{x.text}”</li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const logout = useAuth(s => s.logout);
  const me = useLoad(() => api.get('/api/auth/me'));
  const user = me.data || useAuth.getState().user;

  function leave() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Profile" back={false} />

      <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:gap-y-5 lg:space-y-0">
      <Card className="flex items-center gap-4 p-4 lg:col-start-1 lg:p-6">
        <Avatar name={user?.name} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate font-serif text-2xl font-semibold text-ink-900">{user?.name}</h2>
          <p className="text-sm capitalize text-ink-500">{user?.role}</p>
          {user?.city && <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-700"><MapPin size={14} className="text-saffron-500" />{user.city}</p>}
        </div>
      </Card>

      {!!user?.interests?.length && (
        <Card className="p-4 lg:col-start-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">You enjoy</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {user.interests.map(i => <span key={i} className="rounded-full bg-saffron-50 px-3 py-1 text-sm capitalize text-saffron-700">{i}</span>)}
          </div>
        </Card>
      )}

      {user?.role === 'volunteer' && <MySevaSoFar />}

      <Card className="p-4 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:p-6">
        <h3 className="font-serif text-xl font-semibold text-ink-900">How we serve</h3>
        <ul className="mt-4 space-y-3.5">
          {CONDUCT.map(c => (
            <li key={c.text} className="flex items-start gap-3 text-[15px] text-ink-800">
              <c.icon size={20} className="mt-0.5 shrink-0 text-saffron-500" />
              <span>{c.text} {c.why && <WhyLink rule={c.why} />}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-2.5 lg:col-start-1">
        <Button variant="soft" block onClick={leave}><Repeat size={18} /> Switch user</Button>
        <Button variant="ghost" block onClick={leave}><LogOut size={18} /> Log out</Button>
      </div>
      </div>
    </div>
  );
}
