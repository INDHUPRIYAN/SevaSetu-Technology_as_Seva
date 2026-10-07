// A text box that is ALWAYS visible, plus a mic button. Tap to record, tap to stop; the words are added
// to the box. Speech goes to Bhashini through the bridge (endpoint 29); when the bridge has no speech
// provider (`speech` is false) or that call fails, the browser's own Web Speech API is used instead, when
// it exists. The mic is hidden when neither is possible. Any error just stops the spinner and leaves the
// box as it is — no popup. Use on Post a Need only: the private diary stays type-only.
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { arrayBufferToBase64, blobToWav, TARGET_RATE } from './toWav';
import { Mic, Stop } from './icons';
import { BCP47, dirOf } from '../../lib/languages';

export const MAX_SECONDS = 30;

export function canRecordAudio() {
  return typeof window !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof window.MediaRecorder !== 'undefined'
    && !!(window.AudioContext || window.webkitAudioContext)
    && !!(window.OfflineAudioContext || window.webkitOfflineAudioContext);
}

// the browser's own speech recognition (Chrome, Edge, Safari), used when the bridge has no speech provider
export function browserSpeech() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const STATUS_TEXT = {
  idle: '',
  starting: 'Getting the microphone ready…',
  recording: 'Listening… tap stop when you finish.',
  working: 'Turning your words into text…',
};

export default function VoiceInput({ value, onChange, lang = 'ta', id, label, hint, placeholder, rows = 5, speech, big = false }) {
  const autoId = useId();
  const boxId = id || `voice-${autoId}`;
  const [canRecord] = useState(() => canRecordAudio() || Boolean(browserSpeech()));
  // 'bridge' (Bhashini through the bridge) or 'browser' (Web Speech). speech === false means the bridge has
  // no speech provider, so start in the browser; a failed bridge call also moves to the browser.
  const [mode, setMode] = useState(() => (speech === false || !canRecordAudio() ? 'browser' : 'bridge'));
  useEffect(() => { if (speech === false) setMode('browser'); }, [speech]);
  const [status, setStatus] = useState('idle');
  const [seconds, setSeconds] = useState(0);

  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const rec = useRef({ recorder: null, stream: null, timer: null, ticker: null, alive: true });

  function releaseMic() {
    const r = rec.current;
    clearTimeout(r.timer);
    clearInterval(r.ticker);
    r.stream?.getTracks().forEach(t => t.stop());
    r.stream = null;
  }

  useEffect(() => {
    const r = rec.current;
    r.alive = true;
    return () => {
      r.alive = false;
      if (r.recorder && r.recorder.state !== 'inactive') r.recorder.stop();
      releaseMic();
    };
  }, []);

  function append(words) {
    const current = valueRef.current || '';
    const joiner = current && !/\s$/.test(current) ? ' ' : '';
    onChangeRef.current(current + joiner + words);
  }

  async function finish(blob) {
    if (!rec.current.alive) return;
    setStatus('working');
    try {
      const wav = await blobToWav(blob);
      const result = await api.post('/api/bridge/transcribe', {
        audio: arrayBufferToBase64(wav),
        language: lang,
        samplingRate: TARGET_RATE,
      });
      const words = result?.text?.trim();
      if (words && rec.current.alive) append(words);
    } catch (e) {
      // leave the text box as it is; next time use the browser's own recognition, if it has one
      if (browserSpeech()) setMode('browser');
    } finally {
      if (rec.current.alive) setStatus('idle');
    }
  }

  // Web Speech: the browser listens and gives words; nothing is sent to the bridge
  function startBrowser() {
    const Recognition = browserSpeech();
    if (!Recognition) { setStatus('idle'); return; }
    const recognition = new Recognition();
    recognition.lang = BCP47[lang] || lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = e => {
      const words = Array.from(e.results).map(r => r[0]?.transcript || '').join(' ').trim();
      if (words && rec.current.alive) append(words);
    };
    recognition.onerror = () => { if (rec.current.alive) setStatus('idle'); };
    recognition.onend = () => { clearInterval(rec.current.ticker); clearTimeout(rec.current.timer); if (rec.current.alive) setStatus('idle'); };
    rec.current.recognition = recognition;
    recognition.start();
    setSeconds(0);
    setStatus('recording');
    const startedAt = Date.now();
    rec.current.ticker = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    rec.current.timer = setTimeout(stop, MAX_SECONDS * 1000);
  }

  async function start() {
    setStatus('starting');
    if (mode === 'browser' || !canRecordAudio()) { try { startBrowser(); } catch (e) { setStatus('idle'); } return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!rec.current.alive) { stream.getTracks().forEach(t => t.stop()); return; }
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      recorder.onstop = () => {
        releaseMic();
        finish(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      Object.assign(rec.current, { recorder, stream });
      recorder.start();
      setSeconds(0);
      setStatus('recording');
      const startedAt = Date.now();
      rec.current.ticker = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
      rec.current.timer = setTimeout(stop, MAX_SECONDS * 1000);
    } catch (e) {
      // permission refused, or no microphone: the text box still works
      releaseMic();
      setStatus('idle');
    }
  }

  function stop() {
    const { recorder, recognition } = rec.current;
    clearTimeout(rec.current.timer);
    clearInterval(rec.current.ticker);
    if (recognition) { rec.current.recognition = null; try { recognition.stop(); } catch (e) { /* already stopped */ } return; }
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  const recording = status === 'recording';
  const busy = status === 'starting' || status === 'working';
  const remaining = Math.max(0, MAX_SECONDS - seconds);

  return (
    <div>
      {label && <label htmlFor={boxId} className="mb-2 block text-sm font-semibold text-ink">{label}</label>}
      {hint && <p id={`${boxId}-hint`} className="mb-2 text-sm text-ink-soft">{hint}</p>}
      <div className="relative">
        <textarea
          id={boxId}
          lang={lang}
          dir={dirOf(lang)}
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={hint ? `${boxId}-hint` : undefined}
          className={`block w-full resize-y rounded-2xl border border-line bg-white/80 px-4 py-3 text-base leading-relaxed
            text-ink placeholder:text-ink-soft/70 focus:border-saffron focus:outline-none focus:ring-3 focus:ring-saffron/25
            ${canRecord ? (big ? 'pb-24' : 'pb-16') : ''}`}
        />
        {canRecord && (
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex items-center justify-end gap-3">
            <span className="pointer-events-none min-w-0 truncate text-right text-sm text-ink-soft" aria-hidden="true">
              {recording ? `0:${String(remaining).padStart(2, '0')} left` : ''}
            </span>
            <button
              type="button"
              onClick={recording ? stop : start}
              disabled={busy}
              aria-pressed={recording}
              aria-label={recording ? 'Stop and add the words' : 'Speak instead of typing'}
              className={`pointer-events-auto relative grid ${big ? 'size-20' : 'size-12'} shrink-0 place-items-center rounded-full text-white transition-colors disabled:cursor-wait disabled:opacity-60
                ${recording ? 'bg-saffron-deep' : 'bg-saffron-strong hover:bg-saffron-deep'}`}
            >
              {recording && <span className="absolute inset-0 animate-ping rounded-full bg-saffron/40" aria-hidden="true" />}
              {status === 'working'
                ? <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                : recording ? <Stop className={big ? 'relative size-8' : 'relative size-5'} /> : <Mic className={big ? 'relative size-10' : 'relative size-6'} />}
            </button>
          </div>
        )}
      </div>
      <p className="mt-2 min-h-5 text-sm text-ink-soft" role="status" aria-live="polite">
        {STATUS_TEXT[status]}{status === 'idle' && canRecord && mode === 'browser' ? 'Using this browser’s own speech recognition.' : ''}
      </p>
    </div>
  );
}
