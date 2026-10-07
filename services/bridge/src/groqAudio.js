// services/bridge/src/groqAudio.js — Groq's audio endpoints (OpenAI-compatible): Whisper speech to text, which
// is multilingual (Tamil and Hindi included), and Orpheus text to speech, which is English only.
// Docs: https://console.groq.com/docs/speech-to-text, https://console.groq.com/docs/text-to-speech
// Audio is passed through and dropped: never written to disk, never logged.
const BASE = () => (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions').replace(/\/chat\/completions$/, '');
const apiKey = () => process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
const sttModel = () => process.env.GROQ_STT_MODEL || 'whisper-large-v3';
const ttsModel = () => process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english';
const ttsVoice = () => process.env.GROQ_TTS_VOICE || 'autumn';
const TIMEOUT_MS = () => Number(process.env.DRAFT_TIMEOUT_MS) || 8000;

const isConfigured = () => Boolean(apiKey());

// Speech to text. audioBase64 is a WAV (or any format Groq accepts); language is ISO-639-1 ('ta', 'hi', 'en').
async function transcribe({ audioBase64, language, audioFormat = 'wav' }) {
  if (!apiKey()) throw new Error('LLM_API_KEY is not set');
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(audioBase64, 'base64')], { type: `audio/${audioFormat}` }), `audio.${audioFormat}`);
  form.append('model', sttModel());
  if (language) form.append('language', language);
  form.append('temperature', '0');
  form.append('response_format', 'json');
  const res = await fetch(`${BASE()}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS()),
  });
  if (!res.ok) throw new Error(`Groq transcription ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return typeof body.text === 'string' ? body.text.trim() : '';
}

// Text to speech, English only (Orpheus). Other languages throw at once so the next provider is tried.
async function speak({ text, language }) {
  if (!apiKey()) throw new Error('LLM_API_KEY is not set');
  if (language && language !== 'en') throw new Error(`Groq TTS (${ttsModel()}) speaks English only`);
  const res = await fetch(`${BASE()}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ttsModel(), voice: ttsVoice(), input: text, response_format: 'wav' }),
    signal: AbortSignal.timeout(TIMEOUT_MS()),
  });
  if (!res.ok) throw new Error(`Groq speech ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const audio = Buffer.from(await res.arrayBuffer()).toString('base64');
  return { audioBase64: audio, format: 'wav', samplingRate: null };
}

module.exports = { transcribe, speak, isConfigured };
