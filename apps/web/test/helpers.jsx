// Test helpers: render a B page inside a router, as a given user.
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../src/lib/auth';

export const VOLUNTEER = { _id: '650000000000000000000002', name: 'Kavya Raman', role: 'volunteer' };
export const COORDINATOR = { _id: '650000000000000000000004', name: 'Lakshmi Narayanan', role: 'coordinator' };
export const COMMITMENT = '650000000000000000000041';

export function signIn(user) {
  useAuth.setState({ token: user ? 'test-token' : null, user });
}

function Where() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

// routes: [{ path, element }]; the page under test plus "landing" pages to see where navigation went
export function renderAt(url, routes, { history = [] } = {}) {
  return render(
    <MemoryRouter initialEntries={[...history, url]} initialIndex={history.length}>
      <Routes>
        {routes.map(r => <Route key={r.path} path={r.path} element={r.element} />)}
        <Route path="*" element={<Where />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

// Words that must not appear on B's screens (plan section 9.5)
export const BANNED = /\b(beneficiar\w*|poor|needy|donate|hours|rank|ranks|points|score|streak|badge)\b/i;
