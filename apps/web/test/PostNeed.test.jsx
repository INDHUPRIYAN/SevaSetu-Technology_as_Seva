// Post a Need — plan section 6 (tests U13–U17 at page level).
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../src/lib/api';
import PostNeed from '../src/pages/PostNeed';
import { todayISO } from '../src/components/seva/needDraft';
import { COORDINATOR, renderAt, signIn, VOLUNTEER } from './helpers';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

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

// The Dignity Check stand-in flags "Ravi" and "poor", like the bridge's rules do
function dignity(text) {
  const flags = [...text.matchAll(/Ravi|poor/g)].map(m => ({
    start: m.index, end: m.index + m[0].length, match: m[0], kind: m[0] === 'Ravi' ? 'name' : 'word we avoid',
    why: m[0] === 'Ravi' ? 'Names one person.' : 'Describes people by what they lack.',
  }));
  return { flags, suggestedRewrite: flags.length ? 'A group of students wants help.' : null, source: 'rules' };
}

const needsCalls = () => api.post.mock.calls.filter(([url]) => url === '/api/needs');

function mockBridge({ privacyFlags = [], source = 'ai', draft = DRAFT } = {}) {
  api.post.mockImplementation((url, body) => {
    if (url === '/api/bridge/draft-need') return Promise.resolve({ draft, privacyFlags, source });
    if (url === '/api/bridge/dignity-check') return Promise.resolve(dignity(body.text));
    if (url === '/api/needs') return Promise.resolve({ _id: 'n1', ...draft, status: 'open' });
    return Promise.reject(new Error(url));
  });
}

async function makeDraft(text = '12 students want help reading English aloud on Saturday mornings', lang = 'English') {
  await userEvent.click(screen.getByRole('radio', { name: new RegExp(lang) }));   // the draft language, not the UI toggle
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
    expect(await screen.findByText(/Nothing to change/)).toBeInTheDocument();
  });

  it('U14: Dignity Check highlights the words, says why, and offers a Suggested rewrite', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft('poor boy Ravi, income 5000');
    const check = screen.getByTestId('dignity-check');
    const marks = await within(check).findAllByText(/^(Ravi|poor)$/, { selector: 'mark' });
    expect(marks).toHaveLength(2);
    expect(within(check).getByText(/Names one person\./)).toBeInTheDocument();
    expect(within(check).getByText('Suggested')).toBeInTheDocument();
    expect(check.compareDocumentPosition(screen.getByLabelText('Title')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Use this puts the rewrite in; Keep mine leaves the words as they are', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft('poor boy Ravi, income 5000');
    await userEvent.click(await screen.findByRole('button', { name: 'Use this' }));
    expect(screen.getByLabelText('In the community’s words')).toHaveValue('A group of students wants help.');

    await userEvent.click(screen.getByRole('button', { name: 'Start again' }));
    await userEvent.click(screen.getByRole('button', { name: 'Make draft' }));        // the words are kept
    await userEvent.click(await screen.findByRole('button', { name: 'Keep mine' }));
    expect(screen.getByLabelText('In the community’s words')).toHaveValue('poor boy Ravi, income 5000');
  });

  it('a fallback draft says it is a sample to change', async () => {
    signIn(COORDINATOR);
    mockBridge({ source: 'fallback' });
    open();
    await makeDraft();
    expect(screen.getByText(/this is a sample card/)).toBeInTheDocument();
  });

  async function confirmAndConsent() {
    await userEvent.click(screen.getByLabelText(/they confirmed it/));
    await userEvent.click(screen.getByLabelText(/I consent to publishing this need/));
  }

  it('U15: Publish stays disabled until the community confirmed AND the coordinator consented', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft();
    expect(screen.getByText('Please read this back to the community.')).toBeInTheDocument();
    const publish = screen.getByRole('button', { name: 'Publish need' });
    expect(publish).toBeDisabled();
    await userEvent.click(publish);
    expect(needsCalls()).toHaveLength(0);                              // nothing published
    await userEvent.click(screen.getByLabelText(/they confirmed it/));
    expect(publish).toBeDisabled();                                    // the community alone is not enough
    await userEvent.click(screen.getByLabelText(/I consent to publishing this need/));
    expect(publish).toBeEnabled();
  });

  it('U16: tick → Publish sends the 9 keys + consent to endpoint 6, then back to /coordinator', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft();
    await confirmAndConsent();
    await userEvent.click(screen.getByRole('button', { name: 'Publish need' }));
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(api.post).toHaveBeenLastCalledWith('/api/needs', {
      ...DRAFT,
      consent: { readBack: true, coordinatorConsent: true, agreedOn: todayISO() },
      original: { text: '12 students want help reading English aloud on Saturday mornings', language: 'en' },
    });
  });

  it('a field left empty blocks Publish and is pointed out', async () => {
    signIn(COORDINATOR);
    mockBridge({ draft: { ...DRAFT, place: '', interestTags: [] } });
    open();
    await makeDraft();
    await confirmAndConsent();
    await userEvent.click(screen.getByRole('button', { name: 'Publish need' }));
    expect(screen.getByText('Please say where it happens')).toBeInTheDocument();
    expect(screen.getByText(/at least one interest/)).toBeInTheDocument();
    expect(screen.getByLabelText('Place')).toHaveFocus();
    expect(needsCalls()).toHaveLength(0);
  });

  it('an error from endpoint 6 is shown and the form stays', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft();
    await screen.findByText(/Nothing to change/);
    api.post.mockRejectedValueOnce({ message: 'Please read the card back to the community first' });
    await confirmAndConsent();
    await userEvent.click(screen.getByRole('button', { name: 'Publish need' }));
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
