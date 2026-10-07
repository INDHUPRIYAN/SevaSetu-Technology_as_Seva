// Read It Aloud: one tap plays the whole card in the selected language, so the community can hear exactly
// what will be published. Text to speech only. Bhashini through the bridge (POST /api/bridge/speak) when the
// bridge has a speech provider; otherwise, or if that fails, the browser's own speechSynthesis. The audio is
// played and dropped: nothing is stored. Shown only when at least one of the two can speak.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import Button from '../ui/Button';
import { useT } from '../../i18n';
import { BCP47 } from '../../lib/languages';

export function canSpeakInBrowser() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

export default function ReadAloud({ text, language, speech, className = '' }) {
  const t = useT();
  const [status, setStatus] = useState('idle');         // idle | loading | playing
  const [how, setHow] = useState(null);                  // 'bridge' | 'browser', once it has played
  const audioRef = useRef(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function stop() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (canSpeakInBrowser()) window.speechSynthesis.cancel();
    if (alive.current) setStatus('idle');
  }

  function speakInBrowser() {
    if (!canSpeakInBrowser()) { setStatus('idle'); return false; }
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = BCP47[language] || language;
    u.rate = 0.9;
    u.onend = () => alive.current && setStatus('idle');
    u.onerror = () => alive.current && setStatus('idle');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setHow('browser');
    setStatus('playing');
    return true;
  }

  async function play() {
    if (status === 'playing') { stop(); return; }
    if (!text?.trim()) return;
    setStatus('loading');
    if (speech !== false) {
      try {
        const out = await api.post('/api/bridge/speak', { text, language });
        if (!alive.current) return;
        if (out?.audioBase64) {
          const audio = new Audio(`data:audio/${out.format || 'wav'};base64,${out.audioBase64}`);
          audio.onended = () => alive.current && setStatus('idle');
          audio.onerror = () => { if (alive.current && !speakInBrowser()) setStatus('idle'); };
          audioRef.current = audio;
          await audio.play();
          setHow('bridge');
          setStatus('playing');
          return;
        }
      } catch (e) { /* the browser's own voice instead */ }
    }
    if (!speakInBrowser()) setStatus('idle');
  }

  const possible = speech !== false || canSpeakInBrowser();
  if (!possible) return null;

  return (
    <div className={className}>
      <Button type="button" variant="secondary" onClick={play} disabled={status === 'loading' || !text?.trim()} aria-pressed={status === 'playing'} data-testid="read-aloud">
        {status === 'loading' ? t('Getting the voice ready…') : status === 'playing' ? t('Stop') : t('Read it aloud')}
      </Button>
      <p className="mt-1 text-xs text-ink-soft" role="status" aria-live="polite">
        {status === 'playing' ? (how === 'browser' ? t('Playing with this browser’s own voice.') : t('Playing.')) : t('Plays the whole card in the selected language, for the community to hear.')}
      </p>
    </div>
  );
}
