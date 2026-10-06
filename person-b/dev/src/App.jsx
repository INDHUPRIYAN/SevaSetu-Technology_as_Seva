// Harness routes. The four B routes are mounted exactly as A's routes.jsx will mount personBRoutes.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './stand-ins/auth';
import AppShell from './harness/AppShell';
import Login from './harness/Login';
import Home from './harness/Home';
import MySeva from './harness/MySeva';
import NeedDetail from './harness/NeedDetail';
import Coordinator from './harness/Coordinator';
import { personBRoutes } from './personBRoutes';

function RequireAuth({ children }) {
  const token = useAuth(s => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<Home />} />
          <Route path="/my-seva" element={<MySeva />} />
          <Route path="/needs/demo" element={<NeedDetail />} />
          <Route path="/coordinator" element={<Coordinator />} />
          {personBRoutes.map(r => <Route key={r.path} path={r.path} element={r.element} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
