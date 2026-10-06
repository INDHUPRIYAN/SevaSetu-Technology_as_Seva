// The AI-assisted pieces: Listening Guide and Teaching Finder. AI text is labelled "Suggested";
// without the AI (or the bridge) each still works.
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../src/lib/api';
import ListeningGuide from '../src/components/seva/ListeningGuide';
import TeachingFinder from '../src/components/seva/TeachingFinder';
import { renderAt, signIn, VOLUNTEER } from './helpers';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const NEED = { title: 'English Reading Support', want: 'Twelve students want to read aloud.', place: 'Government School' };
const ITEMS = [
  { _id: 'a', id: 'w05', theme: 'patience', text: 'Purity, patience, and perseverance overcome all obstacles.', source: 'Complete Works, Vol. 4' },
  { _id: 'b', id: 'w08', theme: 'work', text: 'Let us work on.', source: 'Complete Works, Vol. 1' },
];

const show = element => renderAt('/', [{ path: '/', element }]);

describe('ListeningGuide', () => {
  it('shows the 3 questions, labelled Suggested when the AI wrote them', async () => {
    signIn(VOLUNTEER);
    api.post.mockResolvedValue({ questions: ['What first?', 'What helps?', 'What would be good?'], source: 'ai' });
    show(<ListeningGuide need={NEED} />);
    expect(await screen.findByText('What first?')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/api/bridge/listening-guide', expect.objectContaining({ title: NEED.title }));
  });

  it('the fixed questions are not labelled Suggested, and they show even when the bridge is down', async () => {
    signIn(VOLUNTEER);
    api.post.mockRejectedValue({ message: 'down' });
    show(<ListeningGuide need={NEED} />);
    expect(await screen.findByText('What would you like a volunteer to know before they begin?')).toBeInTheDocument();
    expect(screen.queryByText('Suggested')).toBeNull();
  });
});

describe('TeachingFinder', () => {
  it('shows the stored text and source for the id it gets back, never text from the bridge', async () => {
    signIn(VOLUNTEER);
    api.post.mockResolvedValue({ id: 'w05', source: 'ai', text: 'invented words' });
    show(<TeachingFinder items={ITEMS} />);
    await userEvent.type(screen.getByLabelText(/Describe what happened/), 'I had to wait and got impatient');
    await userEvent.click(screen.getByRole('button', { name: /Find a teaching/ }));
    const found = await screen.findByTestId('found-teaching');
    expect(found).toHaveTextContent(ITEMS[0].text);
    expect(found).toHaveTextContent(ITEMS[0].source);
    expect(found).toHaveTextContent('Suggested');
    expect(found).not.toHaveTextContent('invented words');
    expect(api.post).toHaveBeenCalledWith('/api/bridge/find-teaching', { situation: 'I had to wait and got impatient' });
  });

  it('when nothing matches (null), says so kindly', async () => {
    signIn(VOLUNTEER);
    api.post.mockResolvedValue({ id: null, source: 'rules' });
    show(<TeachingFinder items={ITEMS} />);
    await userEvent.type(screen.getByLabelText(/Describe what happened/), 'something else');
    await userEvent.click(screen.getByRole('button', { name: /Find a teaching/ }));
    expect(await screen.findByText(/No checked teaching matches this yet/)).toBeInTheDocument();
  });
});
