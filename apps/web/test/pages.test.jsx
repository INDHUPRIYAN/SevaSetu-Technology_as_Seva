// Diary, Then and Now, Wisdom — plan section 6 screens (tests U3, U5–U7, U10–U12, U18 at page level).
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../src/lib/api';
import Diary from '../src/pages/Diary';
import ThenAndNow from '../src/pages/ThenAndNow';
import Wisdom from '../src/pages/Wisdom';
import { BANNED, COMMITMENT, COORDINATOR, renderAt, signIn, VOLUNTEER } from './helpers';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const Q1 = { _id: 'q1', theme: 'patience', text: 'When did you have to wait today?', teaching: 'Patience and perseverance' };
const Q2 = { _id: 'q2', theme: 'listening', text: 'What did someone tell you that surprised you?', teaching: 'Feel first, organize afterwards' };
const E1 = { _id: 'e1', commitmentId: COMMITMENT, week: 1, text: 'I kept correcting them.', hardDay: false, question: Q1 };

function diaryApi({ week = 2, entries = [E1], commitmentError } = {}) {
  api.get.mockImplementation((url, cfg) => {
    if (url === `/api/commitments/${COMMITMENT}`)
      return commitmentError ? Promise.reject(commitmentError) : Promise.resolve({ _id: COMMITMENT, currentWeek: week, weeks: 4, need: { title: 'English Reading Support' } });
    if (url === '/api/reflect/question') return Promise.resolve(cfg.params.week === 1 ? Q1 : Q2);
    if (url === '/api/reflect/entries') return Promise.resolve(entries);
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  api.post.mockImplementation((url, body) => Promise.resolve({
    _id: 'e2', commitmentId: body.commitmentId, week: body.week, text: body.text.trim(), hardDay: body.hardDay, question: Q2,
  }));
}

const diaryRoutes = [
  { path: '/reflect/:commitmentId', element: <Diary /> },
  { path: '/my-seva', element: <p>My Seva page</p> },
];
const openDiary = opts => renderAt(`/reflect/${COMMITMENT}`, diaryRoutes, opts);

describe('Diary', () => {
  it('U5: "Week 2", one question with its teaching line, the privacy note and the week 1 entry', async () => {
    signIn(VOLUNTEER);
    diaryApi();
    openDiary();
    expect(await screen.findByRole('heading', { level: 1, name: 'Week 2' })).toBeInTheDocument();
    expect(screen.getByText('English Reading Support')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: Q2.text })).toBeInTheDocument();
    expect(screen.queryByText(Q1.text, { selector: 'h2' })).not.toBeInTheDocument();     // only one question to answer
    expect(screen.getByText(Q2.teaching)).toBeInTheDocument();
    expect(screen.getByText('Only you can see this.')).toBeInTheDocument();
    const past = screen.getByRole('list');
    expect(within(past).getByText('I kept correcting them.')).toBeInTheDocument();
    expect(within(past).getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Then and Now/ })).toHaveAttribute('href', `/reflect/${COMMITMENT}/then-and-now`);
    expect(api.get).toHaveBeenCalledWith('/api/reflect/question', { params: { commitmentId: COMMITMENT, week: 2 } });
  });

  it('U6: typing an answer and saving puts it in the list at once', async () => {
    signIn(VOLUNTEER);
    diaryApi();
    openDiary();
    const box = await screen.findByLabelText('Your answer');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await userEvent.type(box, 'I waited, and he finished the sentence himself.');
    await userEvent.click(screen.getByLabelText('This was a hard day'));
    await userEvent.click(save);

    expect(api.post).toHaveBeenCalledWith('/api/reflect/entries', {
      commitmentId: COMMITMENT, week: 2, questionId: 'q2', text: 'I waited, and he finished the sentence himself.', hardDay: true,
    });
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('userId');
    expect(await screen.findByText('Saved in your diary')).toBeInTheDocument();
    const past = screen.getByRole('list');
    expect(within(past).getByText('I waited, and he finished the sentence himself.')).toBeInTheDocument();
    expect(within(past).getByText('This week')).toBeInTheDocument();
    expect(within(past).getByText('A hard day')).toBeInTheDocument();
  });

  it('Hard Day mode: ticking it shows her own earlier words and one question, with no advice or score', async () => {
    signIn(VOLUNTEER);
    diaryApi();
    const { container } = openDiary();
    await userEvent.click(await screen.findByLabelText('This was a hard day'));
    expect(screen.getByText('You wrote, on an earlier week:')).toBeInTheDocument();
    expect(screen.getAllByText(/I kept correcting them\./).length).toBeGreaterThanOrEqual(2);   // in Hard Day and in past entries
    expect(screen.getByText('What was in your hands today, and what was not?')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Practice|Interpretation|score/i);
    await userEvent.click(screen.getByLabelText('This was a hard day'));
    expect(screen.queryByText('What was in your hands today, and what was not?')).toBeNull();
  });

  it('opening the diary again in the same week shows what was written, ready to update', async () => {
    signIn(VOLUNTEER);
    diaryApi({ entries: [E1, { ...E1, _id: 'e2', week: 2, text: 'Already written', hardDay: true, question: Q2 }] });
    openDiary();
    expect(await screen.findByLabelText('Your answer')).toHaveValue('Already written');
    expect(screen.getByLabelText('This was a hard day')).toBeChecked();
  });

  it('U7: Skip goes back and saves nothing', async () => {
    signIn(VOLUNTEER);
    diaryApi();
    openDiary({ history: ['/my-seva'] });
    await userEvent.type(await screen.findByLabelText('Your answer'), 'not saved');
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('My Seva page')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('a failed save keeps the words and says so', async () => {
    signIn(VOLUNTEER);
    diaryApi();
    api.post.mockRejectedValue({ message: 'Please write a few words before saving' });
    openDiary();
    await userEvent.type(await screen.findByLabelText('Your answer'), 'words');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please write a few words before saving');
    expect(screen.getByLabelText('Your answer')).toHaveValue('words');
  });

  it('the diary has no mic: it is type-only, and every call it makes goes to the private reflect service', async () => {
    signIn(VOLUNTEER);
    diaryApi();
    const { container } = openDiary();
    await screen.findByLabelText('Your answer');
    expect(screen.queryByRole('button', { name: /Speak/ })).not.toBeInTheDocument();
    expect(container.querySelector('[aria-label*="Speak"], [aria-label*="record"], [data-testid="voice-input"]')).toBeNull();
    await userEvent.type(screen.getByLabelText('Your answer'), 'I kept correcting them again.');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved in your diary');
    const urls = [...api.get.mock.calls, ...api.post.mock.calls].map(([url]) => url);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).toMatch(/^\/api\/(reflect|commitments)\//);
    expect(urls.some(u => u.includes('/api/bridge'))).toBe(false);
  });

  it('U12: no score, streak, badge, count, share button or photo upload', async () => {
    signIn(VOLUNTEER);
    diaryApi();
    const { container } = openDiary();
    await screen.findByLabelText('Your answer');
    expect(container.textContent).not.toMatch(BANNED);
    expect(container.textContent).not.toMatch(/share|entries so far|\d+ entries/i);
    expect(container.querySelector('input[type=file], img')).toBeNull();
    expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
  });

  it('U18: a coordinator sees that the diary is private, and no entries are fetched', async () => {
    signIn(COORDINATOR);
    diaryApi();
    openDiary();
    expect(screen.getByRole('heading', { name: 'This diary is private' })).toBeInTheDocument();
    expect(screen.queryByText('I kept correcting them.')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('a commitment that cannot be opened shows a message and Try again', async () => {
    signIn(VOLUNTEER);
    diaryApi({ commitmentError: { message: 'Not your commitment' } });
    openDiary();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not open this diary just now.');
    diaryApi();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Week 2' })).toBeInTheDocument();
  });
});

describe('Then and Now', () => {
  const openThenAndNow = (data, sankalpa = null) => {
    api.get.mockImplementation(url => Promise.resolve(url === '/api/reflect/sankalpa' ? sankalpa : data));
    return renderAt(`/reflect/${COMMITMENT}/then-and-now`, [{ path: '/reflect/:commitmentId/then-and-now', element: <ThenAndNow /> }]);
  };
  const E2 = { _id: 'e2', week: 2, text: 'I waited, and he finished the sentence himself.', question: Q2 };

  it('U10: "Then" beside "Now", each with its question and words, her Sankalpa above, no numbers', async () => {
    const { container } = openThenAndNow({ first: E1, latest: E2 }, { text: 'To learn to wait.', sealedAt: '2026-10-01' });
    expect(await screen.findByRole('heading', { name: 'Then' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Now' })).toBeInTheDocument();
    expect(screen.getByText('Your Sankalpa')).toBeInTheDocument();
    expect(screen.getByText(/To learn to wait\./)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Week \d/);
    expect(screen.getByText(Q1.text)).toBeInTheDocument();
    expect(screen.getByText(Q2.text)).toBeInTheDocument();
    expect(screen.getByText(/I kept correcting them\./)).toBeInTheDocument();
    expect(screen.getByText(/he finished the sentence himself/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/They alone live who live for others/);   // no hard-coded quotes
    expect(container.textContent).not.toMatch(BANNED);
    expect(container.querySelector('svg[role=img], canvas, progress, meter')).toBeNull();      // no chart
    expect(api.get).toHaveBeenCalledWith('/api/reflect/then-and-now', { params: { commitmentId: COMMITMENT } });
    expect(api.get).toHaveBeenCalledWith('/api/reflect/sankalpa', { params: { commitmentId: COMMITMENT } });
  });

  it('without a Sankalpa (or if it cannot load), her words still show', async () => {
    api.get.mockImplementation(url => (url === '/api/reflect/sankalpa'
      ? Promise.reject({ message: 'down' }) : Promise.resolve({ first: E1, latest: E2 })));
    renderAt(`/reflect/${COMMITMENT}/then-and-now`, [{ path: '/reflect/:commitmentId/then-and-now', element: <ThenAndNow /> }]);
    expect(await screen.findByRole('heading', { name: 'Then' })).toBeInTheDocument();
    expect(screen.queryByText('Your Sankalpa')).toBeNull();
  });

  it('U11: with no entries, a kind message and a way to the diary — not a blank page', async () => {
    openThenAndNow({ first: null, latest: null });
    expect(await screen.findByText(/begins with a few words/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open your diary' })).toHaveAttribute('href', `/reflect/${COMMITMENT}`);
  });

  it('with one entry, the first words and a note that the newest will come', async () => {
    openThenAndNow({ first: E1, latest: null });
    expect(await screen.findByRole('heading', { name: 'Then' })).toBeInTheDocument();
    expect(screen.getByText(/newest words will appear here/)).toBeInTheDocument();
  });

  it('a failed call shows a message and Try again', async () => {
    api.get.mockRejectedValue({ message: 'down' });
    renderAt(`/reflect/${COMMITMENT}/then-and-now`, [{ path: '/reflect/:commitmentId/then-and-now', element: <ThenAndNow /> }]);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not open your entries');
  });
});

describe('Wisdom', () => {
  const ALL = [
    { _id: '1', theme: 'service', text: 'Service text', source: 'Complete Works, Vol. 1' },
    { _id: '2', theme: 'patience', text: 'Patience text', source: 'Complete Works, Vol. 2' },
    { _id: '3', theme: 'work', text: 'Work text', source: 'Complete Works, Vol. 3' },
  ];

  it('U3: chips (All, Service, Strength, Patience, Work) filter the list; every item shows a source', async () => {
    api.get.mockImplementation((url, cfg) => Promise.resolve(cfg.params.theme ? ALL.filter(w => w.theme === cfg.params.theme) : ALL));
    renderAt('/wisdom', [{ path: '/wisdom', element: <Wisdom /> }]);

    expect(await screen.findByText(/Service text/)).toBeInTheDocument();
    const chips = within(screen.getByRole('group', { name: 'Filter by theme' })).getAllByRole('button');
    expect(chips.map(c => c.textContent)).toEqual(['All', 'Service', 'Strength', 'Patience', 'Work']);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    for (const w of ALL) expect(screen.getByText(w.source)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Patience' }));
    await waitFor(() => expect(screen.queryByText(/Service text/)).not.toBeInTheDocument());
    expect(screen.getByText(/Patience text/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patience' })).toHaveAttribute('aria-pressed', 'true');
    expect(api.get).toHaveBeenLastCalledWith('/api/wisdom', { params: { theme: 'patience' } });

    await userEvent.click(screen.getByRole('button', { name: 'Strength' }));
    expect(await screen.findByText('No checked teachings for this theme yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all themes' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(await screen.findByText(/Work text/)).toBeInTheDocument();
  });

  it('a failed call shows a message and Try again', async () => {
    api.get.mockRejectedValueOnce({ message: 'down' }).mockResolvedValue(ALL);
    renderAt('/wisdom', [{ path: '/wisdom', element: <Wisdom /> }]);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be opened');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/Service text/)).toBeInTheDocument();
  });
});
