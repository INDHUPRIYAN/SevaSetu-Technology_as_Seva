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
import { personBRoutes } from './integration/personB';

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
        ...personBRoutes.map(({ path, element, role }) => ({
          path,
          element: role ? <OnlyFor role={role}>{element}</OnlyFor> : element,
        })),
      ],
    }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
