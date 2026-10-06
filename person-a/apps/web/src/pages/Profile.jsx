import { useNavigate } from 'react-router-dom';
import { CameraOff, Ear, Footprints, HandHeart, LogOut, MapPin, Repeat, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { Avatar, PageHeader } from '../components/ui/Bits';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const CONDUCT = [
  { icon: Footprints, text: 'We go as guests. The community is the host.' },
  { icon: Ear, text: 'We listen first, and serve what was asked for.' },
  { icon: CameraOff, text: 'We take no photos of the people we serve.' },
  { icon: HandHeart, text: 'We keep our weeks. Nobody is compared or scored.' },
  { icon: Users, text: 'If we cannot come, we tell our circle early.' },
];

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
      <Card className="flex items-center gap-4 p-5 lg:col-start-1 lg:p-7">
        <Avatar name={user?.name} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate font-serif text-2xl font-semibold text-ink-900">{user?.name}</h2>
          <p className="text-sm capitalize text-ink-500">{user?.role}</p>
          {user?.city && <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-700"><MapPin size={14} className="text-saffron-500" />{user.city}</p>}
        </div>
      </Card>

      {!!user?.interests?.length && (
        <Card className="p-5 lg:col-start-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">You enjoy</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {user.interests.map(i => <span key={i} className="rounded-full bg-saffron-50 px-3 py-1 text-sm capitalize text-saffron-700">{i}</span>)}
          </div>
        </Card>
      )}

      <Card className="p-5 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:p-7">
        <h3 className="font-serif text-xl font-semibold text-ink-900">How we serve</h3>
        <ul className="mt-4 space-y-3.5">
          {CONDUCT.map(c => (
            <li key={c.text} className="flex items-start gap-3 text-[15px] text-ink-800">
              <c.icon size={20} className="mt-0.5 shrink-0 text-saffron-500" /> {c.text}
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
