// Read It Aloud — plays the card through the bridge's voice when there is one, else the browser's own; never stored.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../src/lib/api';
import ReadAloud from '../src/components/seva/ReadAloud';
import { readBackOf } from '../src/components/seva/needDraft';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

let spoken;
let played;
beforeEach(() => {
  spoken = [];
  played = [];
  window.speechSynthesis = { speak: u => { spoken.push(u); u.onend?.(); }, cancel: vi.fn() };
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  window.Audio = class { constructor(src) { this.src = src; played.push(this); } play() { return Promise.resolve(); } pause() {} };
});
afterEach(() => { delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; delete window.Audio; vi.clearAllMocks(); });

describe('ReadAloud', () => {
  it('with a bridge voice: one tap posts the text and language and plays the returned audio', async () => {
    api.post.mockResolvedValue({ audioBase64: 'UklGRg==', format: 'wav' });
    render(<ReadAloud text="தேவை: ஆங்கிலம்." language="ta" speech />);
    await userEvent.click(screen.getByRole('button', { name: 'Read it aloud' }));
    expect(api.post).toHaveBeenCalledWith('/api/bridge/speak', { text: 'தேவை: ஆங்கிலம்.', language: 'ta' });
    await waitFor(() => expect(played).toHaveLength(1));
    expect(played[0].src).toMatch(/^data:audio\/wav;base64,UklGRg==$/);
    expect(spoken).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('with no bridge voice (speech false): the browser speaks, in the right language, and the bridge is not called', async () => {
    render(<ReadAloud text="Need: English reading." language="en" speech={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Read it aloud' }));
    expect(api.post).not.toHaveBeenCalled();
    expect(spoken).toHaveLength(1);
    expect(spoken[0].lang).toBe('en-IN');
    expect(spoken[0].text).toBe('Need: English reading.');
  });

  it('a failed bridge call falls back to the browser voice', async () => {
    api.post.mockRejectedValue({ message: 'No voice is available here.' });
    render(<ReadAloud text="ज़रूरत: गणित." language="hi" speech />);
    await userEvent.click(screen.getByRole('button', { name: 'Read it aloud' }));
    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0].lang).toBe('hi-IN');
  });

  it('shows nothing when neither the bridge nor the browser can speak', () => {
    delete window.speechSynthesis;
    render(<ReadAloud text="x" language="en" speech={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('readBackOf says the whole card as it stands, with the scaffolding in the selected language', () => {
    const form = { title: 'English Reading', want: 'Students want to read aloud.', place: 'Government School', day: 'Saturday', start: '10:30', end: '12:00', weeks: '4', serveUsWell: 'Let them choose.', youWillLearn: 'To wait.' };
    const en = readBackOf(form, { text: 'said words' }, 'en');
    expect(en).toBe('In the community’s words: said words Need: English Reading. Students want to read aloud. Place: Government School. Every Saturday from 10:30 to 12:00, for 4 weeks. How to serve the group well: Let them choose. A volunteer will learn: To wait.');
    expect(readBackOf(form, null, 'ta')).toMatch(/^தேவை: English Reading\..*ஒவ்வொரு Saturday 10:30 முதல் 12:00 வரை, 4 வாரங்களுக்கு\./);
    expect(readBackOf({ title: 'x' }, null, 'hi')).toBe('ज़रूरत: x.');
  });
});
