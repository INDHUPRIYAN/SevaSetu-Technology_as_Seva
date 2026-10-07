// A private voice note for this week's diary. Recorded in the browser (MediaRecorder), sent ONLY to the private
// reflect service (POST /api/reflect/voice), played back only here. It is never transcribed and never reaches a
// model or a speech service: the bytes go in, the same bytes come out. Hidden when the browser cannot record.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

export const MAX_SECONDS = 60;

const canRecord = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined';

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function VoiceNotePlayer({ note, label }) {
  if (!note?.audioBase64) return null;
  return (
    <figure className="rounded-2xl bg-peach-soft px-4 py-3" data-testid="voice-note-player">
      {label && <figcaption className="text-xs font-semibold tracking-wide text-ember uppercase">{label}</figcaption>}
      <audio controls preload="none" className="mt-2 w-full" src={`data:${note.mimeType};base64,${note.audioBase64}`} aria-label={label || 'Your voice note'} />
      {note.seconds != null && <p className="mt-1 text-xs text-ink-soft">{note.seconds} s · only you can hear this</p>}
    </figure>
  );
}

export default function VoiceNote({ commitmentId, week }) {
  const [supported] = useState(canRecord);
  const [status, setStatus] = useState('idle');          // idle | recording | saving
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState(null);                // { mimeType, seconds, audioBase64 } for this week
  const [error, setError] = useState('');
  const rec = useRef({ recorder: null, stream: null, timer: null, ticker: null, alive: true });

  useEffect(() => {
    let alive = true;
    rec.current.alive = true;
    api.get('/api/reflect/voice', { params: { commitmentId, week } }).then(n => alive && setNote(n)).catch(() => {});
    return () => { alive = false; rec.current.alive = false; stop(); release(); };
  }, [commitmentId, week]); // eslint-disable-line react-hooks/exhaustive-deps

  function release() {
    clearTimeout(rec.current.timer);
    clearInterval(rec.current.ticker);
    rec.current.stream?.getTracks().forEach(t => t.stop());
    rec.current.stream = null;
  }

  async function save(blob, mimeType, length) {
    if (!rec.current.alive) return;
    setStatus('saving');
    setError('');
    try {
      const audioBase64 = await toBase64(blob);
      await api.post('/api/reflect/voice', { commitmentId, week, mimeType, audioBase64, seconds: length });
      if (rec.current.alive) setNote({ mimeType, seconds: length, audioBase64 });
    } catch (e) {
      if (rec.current.alive) setError(e?.message || 'Could not keep the recording. Try again.');
    } finally {
      if (rec.current.alive) setStatus('idle');
    }
  }

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!rec.current.alive) { stream.getTracks().forEach(t => t.stop()); return; }
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      const startedAt = Date.now();
      recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      recorder.onstop = () => {
        release();
        const mimeType = (recorder.mimeType || 'audio/webm').split(';')[0];
        save(new Blob(chunks, { type: mimeType }), mimeType, Math.round((Date.now() - startedAt) / 1000));
      };
      Object.assign(rec.current, { recorder, stream });
      recorder.start();
      setSeconds(0);
      setStatus('recording');
      rec.current.ticker = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
      rec.current.timer = setTimeout(stop, MAX_SECONDS * 1000);
    } catch (e) {
      release();
      setStatus('idle');
      setError('The microphone is not available. Your written words are kept just the same.');
    }
  }

  function stop() {
    const { recorder } = rec.current;
    clearTimeout(rec.current.timer);
    clearInterval(rec.current.ticker);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  async function remove() {
    try {
      await api.delete('/api/reflect/voice', { params: { commitmentId, week } });
      setNote(null);
    } catch (e) { setError(e?.message || 'Could not remove it. Try again.'); }
  }

  if (!supported) return null;
  const recording = status === 'recording';

  return (
    <section aria-labelledby="voice-note" className="rounded-2xl border border-line bg-surface p-4" data-testid="voice-note">
      <h2 id="voice-note" className="font-serif text-lg font-semibold text-ink">A voice note, if you like</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Say it instead of writing it. The recording is kept for you alone: it is never written down, never sent to any
        service, and nobody else can play it.
      </p>
      {note && !recording && status !== 'saving' && (
        <div className="mt-3">
          <VoiceNotePlayer note={note} label={`Week ${week}`} />
          <button type="button" onClick={remove} className="mt-2 text-sm text-ink-soft underline-offset-2 hover:underline">Remove this note</button>
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={status === 'saving'}
          aria-pressed={recording}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold text-white disabled:opacity-60 ${recording ? 'bg-saffron-deep' : 'bg-saffron-strong hover:bg-saffron-deep'}`}
        >
          {status === 'saving' ? 'Keeping it…' : recording ? `Stop (${MAX_SECONDS - seconds} s left)` : note ? 'Record again' : 'Record a voice note'}
        </button>
        <span className="text-sm text-ink-soft" role="status" aria-live="polite">{recording ? 'Recording… tap stop when you finish.' : ''}</span>
      </div>
      {error && <p className="mt-2 text-sm text-ember" role="alert">{error}</p>}
    </section>
  );
}
