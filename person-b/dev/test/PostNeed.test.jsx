// Post a Need — plan section 6 (tests U13–U17 at page level).
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../src/stand-ins/api';
import PostNeed from '../../apps/web/src/pages/PostNeed';
import { todayISO } from '../../apps/web/src/components/seva/needDraft';
import { COORDINATOR, renderAt, signIn, VOLUNTEER } from './helpers';

vi.mock('../src/stand-ins/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const DRAFT = {
  title: 'English Reading Support', want: 'A group of 12 students would like help to read English aloud.',
  serveUsWell: 'Come on time every Saturday.', youWillLearn: 'Patience.', groupSize: 12, interestTags: ['teaching', 'reading'],
  rhythm: { day: 'Saturday', start: '10:30', end: '12:00' }, weeks: 4, place: 'Government School, Kanchipuram',
};

const routes = [
  { path: '/coordinator/post-need', element: <PostNeed /> },
  { path: '/coordinator', element: <p>Dashboard page</p> },
  { path: '/', element: <p>Volunteer home</p> },
  { path: '/login', element: <p>Login page</p> },
];
const open = () => renderAt('/coordinator/post-need', routes);

function mockBridge({ privacyFlags = [], source = 'ai', draft = DRAFT } = {}) {
  api.post.mockImplementation(url => {
    if (url === '/api/bridge/draft-need') return Promise.resolve({ draft, privacyFlags, source });
    if (url === '/api/needs') return Promise.resolve({ _id: 'n1', ...draft, status: 'open' });
    return Promise.reject(new Error(url));
  });
}

async function makeDraft(text = '12 students want help reading English aloud on Saturday mornings', lang = 'English') {
  await userEvent.click(screen.getByText(lang));
  await userEvent.type(screen.getByLabelText('What does the community need?'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Make draft' }));
  return screen.findByRole('heading', { name: 'Check the card' });
}

describe('Post a Need', () => {
  it('U17: a volunteer is sent away from the page', () => {
    signIn(VOLUNTEER);
    open();
    expect(screen.getByText('Volunteer home')).toBeInTheDocument();
  });

  it('nobody logged in → the login page', () => {
    signIn(null);
    open();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('step 1: Tamil is picked first; "Make draft" waits for words; the mic box is the VoiceInput', () => {
    signIn(COORDINATOR);
    open();
    expect(screen.getByRole('radio', { name: /தமிழ்/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Make draft' })).toBeDisabled();
    expect(screen.getByLabelText('What does the community need?')).toHaveAttribute('lang', 'ta');
  });

  it('U13: Make draft sends the words and language, then every field is filled and editable', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft('Tamil words here', 'English');
    expect(api.post).toHaveBeenCalledWith('/api/bridge/draft-need', { text: 'Tamil words here', language: 'en' });

    expect(screen.getByLabelText('Title')).toHaveValue('English Reading Support');
    expect(screen.getByLabelText('What we want')).toHaveValue(DRAFT.want);
    expect(screen.getByLabelText('How to serve us well')).toHaveValue(DRAFT.serveUsWell);
    expect(screen.getByLabelText('What you will learn')).toHaveValue(DRAFT.youWillLearn);
    expect(screen.getByLabelText('Place')).toHaveValue(DRAFT.place);
    expect(screen.getByLabelText('Group size')).toHaveValue(12);
    expect(screen.getByLabelText('Interests')).toHaveValue('teaching, reading');
    expect(screen.getByLabelText('Day')).toHaveValue('Saturday');
    expect(screen.getByLabelText('From')).toHaveValue('10:30');
    expect(screen.getByLabelText('To')).toHaveValue('12:00');
    expect(screen.getByLabelText('Weeks')).toHaveValue(4);

    const title = screen.getByLabelText('Title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Reading Together');
    expect(title).toHaveValue('Reading Together');
    expect(screen.queryByTestId('privacy-warnings')).not.toBeInTheDocument();
  });

  it('U14: privacy warnings show in yellow above the form', async () => {
    signIn(COORDINATOR);
    mockBridge({ privacyFlags: ['Mentions money or income', 'Uses a word we avoid (poor / needy / beneficiary)'] });
    open();
    await makeDraft('poor boy Ravi, income 5000');
    const warnings = screen.getByTestId('privacy-warnings');
    expect(within(warnings).getByText('Mentions money or income')).toBeInTheDocument();
    expect(within(warnings).getAllByRole('listitem')).toHaveLength(2);
    expect(warnings.compareDocumentPosition(screen.getByLabelText('Title')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a fallback draft says it is a sample to change', async () => {
    signIn(COORDINATOR);
    mockBridge({ source: 'fallback' });
    open();
    await makeDraft();
    expect(screen.getByText(/this is a sample card/)).toBeInTheDocument();
  });

  it('U15: Publish is disabled until the read-back tick is on', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft();
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    await userEvent.click(publish);
    expect(api.post).toHaveBeenCalledTimes(1);                         // only the draft call
    await userEvent.click(screen.getByLabelText(/I read this back to the community and they agreed/));
    expect(publish).toBeEnabled();
  });

  it('U16: tick → Publish sends the 9 keys + consent to endpoint 6, then back to /coordinator', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft();
    await userEvent.click(screen.getByLabelText(/I read this back/));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(api.post).toHaveBeenLastCalledWith('/api/needs', { ...DRAFT, consent: { readBack: true, agreedOn: todayISO() } });
  });

  it('a field left empty blocks Publish and is pointed out', async () => {
    signIn(COORDINATOR);
    mockBridge({ draft: { ...DRAFT, place: '', interestTags: [] } });
    open();
    await makeDraft();
    await userEvent.click(screen.getByLabelText(/I read this back/));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByText('Please say where it happens')).toBeInTheDocument();
    expect(screen.getByText(/at least one interest/)).toBeInTheDocument();
    expect(screen.getByLabelText('Place')).toHaveFocus();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('an error from endpoint 6 is shown and the form stays', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft();
    api.post.mockRejectedValueOnce({ message: 'Please read the card back to the community first' });
    await userEvent.click(screen.getByLabelText(/I read this back/));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Please read the card back to the community first')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('a failed draft call keeps the words and says so', async () => {
    signIn(COORDINATOR);
    api.post.mockRejectedValue({ message: 'Coordinators only' });
    open();
    await userEvent.type(screen.getByLabelText('What does the community need?'), 'words');
    await userEvent.click(screen.getByRole('button', { name: 'Make draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Coordinators only');
    expect(screen.getByLabelText('What does the community need?')).toHaveValue('words');
  });

  it('Start again goes back to step 1 with the words kept', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft('my sentence');
    await userEvent.click(screen.getByRole('button', { name: 'Start again' }));
    expect(screen.getByLabelText('What does the community need?')).toHaveValue('my sentence');
  });
});
