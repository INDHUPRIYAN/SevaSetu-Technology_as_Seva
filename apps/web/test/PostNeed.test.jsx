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

// The VoiceBridge stand-in answers every turn with the whole draft and nothing missing (one complete sentence)
function mockBridge({ privacyFlags = [], source = 'ai', draft = DRAFT, missing = [], question = null } = {}) {
  api.get.mockImplementation(url => {
    if (url === '/api/bridge/capabilities') return Promise.resolve({ llm: source === 'ai', speech: false });
    if (url === '/api/coordinator/overview') return Promise.resolve({ needs: [{ _id: 'n0', title: 'Earlier card', place: 'Government School', rhythm: { day: 'Saturday' }, weeks: 4, orgName: 'Govt School' }] });
    return Promise.reject(new Error(url));
  });
  api.post.mockImplementation((url, body) => {
    if (url === '/api/bridge/voicebridge') return Promise.resolve({ draft, missing, question, readBack: 'Read back.', relatedCardId: null, privacyFlags, source });
    if (url === '/api/bridge/dignity-check') return Promise.resolve(dignity(body.text));
    if (url === '/api/needs') return Promise.resolve({ _id: 'n1', ...draft, status: 'open' });
    return Promise.reject(new Error(url));
  });
}

// say one sentence, then take the card to the form
async function makeDraft(text = '12 students want help reading English aloud on Saturday mornings', lang = 'English') {
  await userEvent.click(screen.getByRole('radio', { name: new RegExp(lang) }));   // the draft language, not the UI toggle
  await userEvent.type(screen.getByLabelText('What does the community need?'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Check the card' }));
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

  it('step 1: Tamil is picked first; "Send" waits for words; the mic box is the VoiceInput; no card yet', () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    expect(screen.getByRole('radio', { name: /தமிழ்/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByLabelText('What does the community need?')).toHaveAttribute('lang', 'ta');
    expect(screen.queryByRole('button', { name: 'Check the card' })).not.toBeInTheDocument();
  });

  it('VoiceBridge: a vague sentence gets ONE question in the language; the card builds live with the gaps marked; the next answer is sent with the turns and draft', async () => {
    signIn(COORDINATOR);
    const partial = { ...DRAFT, place: '', weeks: 0, serveUsWell: '' };
    mockBridge({ draft: partial, missing: ['place', 'weeks', 'serveUsWell'], question: { field: 'place', text: 'இது எங்கே நடக்கும்?' }, source: 'rules' });
    open();
    await userEvent.type(screen.getByLabelText('What does the community need?'), 'குழந்தைகளுக்கு உதவி');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByTestId('voicebridge-prompt')).toHaveTextContent('இது எங்கே நடக்கும்?');
    expect(screen.getByText('Question 1 of 3', { exact: false })).toBeInTheDocument();
    const card = screen.getByTestId('live-card');
    expect(within(card).getByText('Built from your words')).toBeInTheDocument();
    expect(card.querySelector('[data-field="place"]')).toHaveAttribute('data-empty', 'true');
    expect(card.querySelector('[data-field="weeks"]')).toHaveAttribute('data-empty', 'true');
    expect(card.querySelector('[data-field="day"]')).toHaveAttribute('data-empty', 'false');
    expect(screen.getByLabelText('Your answer')).toHaveValue('');                            // the box clears for the answer

    await userEvent.type(screen.getByLabelText('Your answer'), 'அரசுப் பள்ளி');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    const [, body] = api.post.mock.calls.filter(([url]) => url === '/api/bridge/voicebridge').at(-1);
    expect(body.language).toBe('ta');
    expect(body.draft).toEqual(partial);
    expect(body.turns.map(x => x.role)).toEqual(['coordinator', 'app', 'coordinator']);
    expect(body.turns[1]).toMatchObject({ field: 'place', text: 'இது எங்கே நடக்கும்?' });
    expect(body.context.recentCards).toEqual([{ _id: 'n0', title: 'Earlier card', place: 'Government School', rhythm: { day: 'Saturday' }, weeks: 4 }]);
    // the form marks the still-missing fields for typing
    await userEvent.click(screen.getByRole('button', { name: 'Check the card' }));
    expect(await screen.findByText('Please say where it happens')).toBeInTheDocument();
    expect(screen.getByLabelText('Weeks')).toHaveValue(null);
  });

  it('U13: the sentence goes to VoiceBridge with the language, then every field is filled and editable', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft('Tamil words here', 'English');
    expect(api.post).toHaveBeenCalledWith('/api/bridge/voicebridge', expect.objectContaining({
      language: 'en', draft: null, turns: [{ role: 'coordinator', text: 'Tamil words here' }],
    }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Check the card' }));    // the conversation is kept
    await userEvent.click(await screen.findByRole('button', { name: 'Keep mine' }));
    expect(screen.getByLabelText('In the community’s words')).toHaveValue('poor boy Ravi, income 5000');
  });

  it('with no AI the card says it was built by rules, and never says "Suggested"', async () => {
    signIn(COORDINATOR);
    mockBridge({ source: 'rules' });
    open();
    await makeDraft();
    expect(screen.getByText(/Built from your words by simple rules, with no AI/)).toBeInTheDocument();
    expect(screen.queryByText(/Suggested draft/)).not.toBeInTheDocument();
  });

  it('with AI the card is labelled "Suggested — please review"', async () => {
    signIn(COORDINATOR);
    mockBridge({ source: 'ai' });
    open();
    await makeDraft();
    expect(screen.getByText(/Suggested draft — please check every field/)).toBeInTheDocument();
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

  it('a failed VoiceBridge call keeps the words and says so', async () => {
    signIn(COORDINATOR);
    api.get.mockRejectedValue(new Error('offline'));
    api.post.mockRejectedValue({ message: 'Coordinators only' });
    open();
    await userEvent.type(screen.getByLabelText('What does the community need?'), 'words');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Coordinators only');
    expect(screen.getByLabelText('What does the community need?')).toHaveValue('words');
  });

  it('Start again goes back to step 1 with the conversation kept', async () => {
    signIn(COORDINATOR);
    mockBridge();
    open();
    await makeDraft('my sentence');
    await userEvent.click(screen.getByRole('button', { name: 'Start again' }));
    expect(screen.getByText('my sentence')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check the card' })).toBeInTheDocument();
  });
});
