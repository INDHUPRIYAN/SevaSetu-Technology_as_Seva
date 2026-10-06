// VoiceInput — text box always visible, mic only when the browser can record, no error popups.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { api } from '../src/stand-ins/api';
import VoiceInput, { MAX_SECONDS } from '../../apps/web/src/components/seva/VoiceInput';
import { encodeWav } from '../../apps/web/src/components/seva/toWav';

vi.mock('../src/stand-ins/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../apps/web/src/components/seva/toWav', async importOriginal => {
  const real = await importOriginal();
  return { ...real, blobToWav: vi.fn(async () => real.encodeWav(new Float32Array(4))) };
});

function Box({ initial = '', lang = 'ta' }) {
  const [value, setValue] = useState(initial);
  return <VoiceInput value={value} onChange={setValue} lang={lang} label="Need" />;
}

// a browser that can record: fake getUserMedia, MediaRecorder and AudioContext
let tracks;
let lastRecorder;
function installRecordingBrowser({ getUserMedia } = {}) {
  tracks = [{ stop: vi.fn() }];
  class FakeRecorder {
    constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; lastRecorder = this; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) });
      this.onstop?.();
    }
  }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: getUserMedia || vi.fn(async () => ({ getTracks: () => tracks })) },
  });
  window.MediaRecorder = FakeRecorder;
  window.AudioContext = class {};
  window.OfflineAudioContext = class {};
}

function uninstall() {
  delete navigator.mediaDevices;
  delete window.MediaRecorder;
  delete window.AudioContext;
  delete window.OfflineAudioContext;
}

beforeEach(() => { vi.spyOn(window, 'alert').mockImplementation(() => {}); });
afterEach(() => { uninstall(); vi.useRealTimers(); });

describe('VoiceInput', () => {
  it('without recording support: the text box works and there is no mic', async () => {
    render(<Box />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Need'), 'typed words');
    expect(screen.getByLabelText('Need')).toHaveValue('typed words');
  });

  it('tap to record, tap to stop: a 16 kHz WAV goes to endpoint 29 and the words are added to the box', async () => {
    installRecordingBrowser();
    api.post.mockResolvedValue({ text: 'வணக்கம் நண்பர்களே' });
    render(<Box initial="Saturday" lang="ta" />);

    await userEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
    const stop = await screen.findByRole('button', { name: 'Stop and add the words' });
    expect(stop).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Listening');

    await userEvent.click(stop);
    await waitFor(() => expect(screen.getByLabelText('Need')).toHaveValue('Saturday வணக்கம் நண்பர்களே'));

    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe('/api/bridge/transcribe');
    expect(body.language).toBe('ta');
    expect(body.samplingRate).toBe(16000);
    expect(atob(body.audio).slice(0, 4)).toBe('RIFF');
    expect(tracks[0].stop).toHaveBeenCalled();                  // the mic is released
    expect(screen.getByRole('button', { name: 'Speak instead of typing' })).toBeEnabled();
  });

  it('U9: refusing the microphone leaves the box as it is, with no popup', async () => {
    installRecordingBrowser({ getUserMedia: vi.fn(async () => { throw new DOMException('denied', 'NotAllowedError'); }) });
    render(<Box initial="my words" />);
    await userEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(''));
    expect(screen.getByLabelText('Need')).toHaveValue('my words');
    expect(window.alert).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Need'), '!');
    expect(screen.getByLabelText('Need')).toHaveValue('my words!');
  });

  it('B14 from the browser: when transcribe fails, the spinner stops and the box is unchanged', async () => {
    installRecordingBrowser();
    api.post.mockRejectedValue({ message: 'Could not hear that. Please type instead.' });
    render(<Box initial="my words" />);
    await userEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Stop and add the words' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Speak instead of typing' })).toBeEnabled());
    expect(screen.getByLabelText('Need')).toHaveValue('my words');
    expect(window.alert).not.toHaveBeenCalled();
  });

  it(`stops by itself after ${MAX_SECONDS} seconds`, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installRecordingBrowser();
    api.post.mockResolvedValue({ text: 'done' });
    render(<Box />);
    await act(async () => { screen.getByRole('button', { name: 'Speak instead of typing' }).click(); });
    await screen.findByRole('button', { name: 'Stop and add the words' });
    expect(lastRecorder.state).toBe('recording');
    await act(async () => { vi.advanceTimersByTime(MAX_SECONDS * 1000 + 10); });
    expect(lastRecorder.state).toBe('inactive');
    await waitFor(() => expect(screen.getByLabelText('Need')).toHaveValue('done'));
  });

  it('empty words from Bhashini add nothing', async () => {
    installRecordingBrowser();
    api.post.mockResolvedValue({ text: '  ' });
    render(<Box initial="kept" />);
    await userEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Stop and add the words' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Speak instead of typing' })).toBeEnabled());
    expect(screen.getByLabelText('Need')).toHaveValue('kept');
  });

  it('the WAV helper is the real encoder (sanity check of the mock)', () => {
    expect(new DataView(encodeWav(new Float32Array(1))).getUint32(24, true)).toBe(16000);
  });
});
