// WisdomCard, WhyLink / WhyModal — plan section 6 behaviour (tests U1–U4 at component level).
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../src/lib/api';
import WisdomCard from '../src/components/seva/WisdomCard';
import WhyLink from '../src/components/seva/WhyLink';
import { renderAt, signIn, VOLUNTEER } from './helpers';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const TODAY = { _id: 'w1', theme: 'service', text: 'They alone live who live for others.', source: 'Complete Works, Vol. 4' };
const WHY = {
  'no-hours': {
    ruleKey: 'no-hours',
    title: "Why don't we count time?",
    teaching: { quote: 'All great things must of necessity be slow.', source: 'Complete Works, Vol. 6' },
    interpretation: 'Seva that changes something is slow and steady.',
    decision: 'We mark the weeks you kept, and never log time.',
  },
};

describe('WisdomCard', () => {
  it('U1: shows "Seva Wisdom for Today", the quote and its source', async () => {
    api.get.mockResolvedValue(TODAY);
    renderAt('/', [{ path: '/', element: <WisdomCard /> }]);
    expect(await screen.findByText('Seva Wisdom for Today')).toBeInTheDocument();
    expect(screen.getByText(/They alone live who live for others/)).toBeInTheDocument();
    expect(screen.getByText('Complete Works, Vol. 4')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/wisdom/today');
  });

  it('U2: if the call fails it shows nothing and does not throw', async () => {
    api.get.mockRejectedValue({ message: 'This service is not connected yet' });
    const { container } = renderAt('/', [{ path: '/', element: <div data-testid="home"><WisdomCard /></div> }]);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 10));
    expect(screen.getByTestId('home')).toBeEmptyDOMElement();
    expect(container.textContent).not.toMatch(/Wisdom/);
  });

  it('U3: "Read More" goes to /wisdom', async () => {
    api.get.mockResolvedValue(TODAY);
    renderAt('/', [{ path: '/', element: <WisdomCard /> }]);
    await userEvent.click(await screen.findByRole('link', { name: /Read More/ }));
    expect(screen.getAllByTestId('location').at(-1)).toHaveTextContent('/wisdom');
  });
});

describe('WhyLink and WhyModal', () => {
  const open = async () => {
    signIn(VOLUNTEER);
    api.get.mockImplementation(url => {
      const rule = url.split('/').pop();
      return WHY[rule] ? Promise.resolve(WHY[rule]) : Promise.reject({ message: 'No teaching for this rule' });
    });
    renderAt('/', [{ path: '/', element: <><button type="button">before</button><WhyLink rule="no-hours" /></> }]);
    await userEvent.click(screen.getByRole('button', { name: 'Why?' }));
    return screen.findByRole('dialog');
  };

  it('U4: opens a dialog with the right title and teaching for the rule', async () => {
    const dialog = await open();
    expect(api.get).toHaveBeenCalledWith('/api/wisdom/why/no-hours');
    expect(await screen.findByRole('heading', { name: "Why don't we count time?" })).toBeInTheDocument();
    // teaching, interpretation and decision are shown as three labelled parts
    expect(dialog).toHaveTextContent('Verified teaching');
    expect(dialog).toHaveTextContent('All great things must of necessity be slow.');
    expect(dialog).toHaveTextContent('Complete Works, Vol. 6');
    expect(dialog).toHaveTextContent('Interpretation');
    expect(dialog).toHaveTextContent('Seva that changes something is slow and steady.');
    expect(dialog).toHaveTextContent('We mark the weeks you kept, and never log time.');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('U4: the Close button closes it and focus goes back to "Why?"', async () => {
    await open();
    await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Why?' })).toHaveFocus();
  });

  it('U4: tapping outside closes it; tapping inside does not', async () => {
    const dialog = await open();
    await userEvent.click(dialog);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('why-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc closes it', async () => {
    await open();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the close (×) button gets focus when it opens', async () => {
    await open();
    expect(screen.getAllByRole('button', { name: 'Close' })[0]).toHaveFocus();
  });

  it('an unknown rule shows a calm message, not a crash', async () => {
    signIn(VOLUNTEER);
    api.get.mockRejectedValue({ message: 'No teaching for this rule' });
    renderAt('/', [{ path: '/', element: <WhyLink rule="abc" /> }]);
    await userEvent.click(screen.getByRole('button', { name: 'Why?' }));
    expect(await screen.findByText(/could not be opened just now/)).toBeInTheDocument();
  });
});
