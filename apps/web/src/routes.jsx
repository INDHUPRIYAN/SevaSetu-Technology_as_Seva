import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { homeFor, useAuth } from './lib/auth';
import AppShell from './components/ui/AppShell';
import Login from './pages/Login';
import Home from './pages/Home';
import Opportunities from './pages/Opportunities';
import NeedDetail from './pages/NeedDetail';
import ListenFirst from './pages/ListenFirst';
import Commit from './pages/Commit';
import MySeva from './pages/MySeva';
import Profile from './pages/Profile';
import Coordinator from './pages/Coordinator';
import Wisdom from './pages/Wisdom';
import Diary from './pages/Diary';
import ThenAndNow from './pages/ThenAndNow';
import PostNeed from './pages/PostNeed';
import Resources from './pages/Resources';

function RequireLogin() {
  const token = useAuth(s => s.token);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

// a volunteer who types /coordinator lands on their own home, and the other way round
function OnlyFor({ role, children }) {
  const user = useAuth(s => s.user);
  return user?.role === role ? children : <Navigate to={homeFor(user)} replace />;
}

const volunteer = el => <OnlyFor role="volunteer">{el}</OnlyFor>;

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireLogin />,
    children: [{
      element: <AppShell />,
      children: [
        { path: '/', element: volunteer(<Home />) },
        { path: '/opportunities', element: volunteer(<Opportunities />) },
        { path: '/needs/:id', element: volunteer(<NeedDetail />) },
        { path: '/needs/:id/listen', element: volunteer(<ListenFirst />) },
        { path: '/commit/:visitId', element: volunteer(<Commit />) },
        { path: '/my-seva', element: volunteer(<MySeva />) },
        { path: '/profile', element: <Profile /> },
        { path: '/coordinator', element: <OnlyFor role="coordinator"><Coordinator /></OnlyFor> },
        { path: '/coordinator/post-need', element: <OnlyFor role="coordinator"><PostNeed /></OnlyFor> },
        { path: '/coordinator/resources', element: <OnlyFor role="coordinator"><Resources /></OnlyFor> },
        { path: '/wisdom', element: <Wisdom /> },
        // the diary explains itself to a coordinator ("This diary is private") instead of redirecting
        { path: '/reflect/:commitmentId', element: <Diary /> },
        { path: '/reflect/:commitmentId/then-and-now', element: volunteer(<ThenAndNow />) },
      ],
    }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
