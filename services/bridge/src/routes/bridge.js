// Endpoints 28–29. The AI never publishes: it only drafts, and a person edits and publishes.
const express = require('express');
const { normalizeDraft, fallbackDraft } = require('../draft');
const { findPrivacyFlags } = require('../privacy');

const PROMPT = `You turn a community coordinator's words into a need card.
Return ONLY JSON with these keys:
title, want, serveUsWell, youWillLearn, groupSize, interestTags, rhythm {day,start,end}, weeks, place.
Rules: describe the GROUP, never one person. Do not include any person's name, age, income,
caste, religion or health detail, even if the coordinator says them. Write "a group of students",
never a name. Use respectful words: never "poor", "needy", "beneficiary".
Write the card in English. If something is not said, leave it as an empty string.
groupSize is the number of people in the group (0 if not said). weeks is a number (4 if not said).
rhythm.day is a full English weekday such as "Saturday". rhythm.start and rhythm.end are 24-hour
"HH:MM" times. interestTags are 1 to 3 short lowercase words such as "teaching" or "reading".`;

const { CODES: LANGUAGES } = require('../languages');
const MAX_TEXT = 5000;

// Never wait longer than `ms`, and never leave a timer running after the race is over.
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const fail = (res, status, message) => res.status(status).json({ error: { message } });

function bridgeRouter({ callLLM, translate, transcribe, speak, draftTimeoutMs, translateTimeoutMs }) {
  const router = express.Router();

  // 28. Coordinator's words → draft need card + privacy warnings
  router.post('/draft-need', async (req, res) => {
    if (req.headers['x-user-role'] !== 'coordinator') return fail(res, 403, 'Coordinators only');

    const { text, language = 'en' } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return fail(res, 400, 'Please say or type the need');
    if (text.length > MAX_TEXT) return fail(res, 400, `Please keep it under ${MAX_TEXT} characters`);
    if (!LANGUAGES.includes(language)) return fail(res, 400, 'Language must be one of ' + LANGUAGES.join(', '));

    // Bhashini translates first, so Groq drafts from good English. If it fails, Groq gets the original.
    let input = text;
    if (language !== 'en') {
      try {
        const english = await withTimeout(translate({ text, from: language }), translateTimeoutMs);
        if (english && english.trim()) input = `${english}\n\nOriginal: ${text}`;
      } catch (e) { /* Groq reads the original language directly */ }
    }

    let draft = fallbackDraft();
    let source = 'fallback';
    try {
      const raw = await withTimeout(callLLM(PROMPT, input, language), draftTimeoutMs);
      draft = normalizeDraft(JSON.parse(raw));
      source = 'ai';
    } catch (e) { /* keep the fallback draft */ }

    // check both what was said and what was drafted
    const privacyFlags = findPrivacyFlags(`${text} ${JSON.stringify(draft)}`);
    res.json({ data: { draft, privacyFlags, source } });
  });

  // 29. Speech to text through Bhashini. The browser never sees the Bhashini key.
  // The audio is passed on and dropped: it is never stored or logged.
  router.post('/transcribe', async (req, res) => {
    if (!req.headers['x-user-id']) return fail(res, 401, 'Please log in');

    const { audio, language = 'ta', samplingRate = 16000 } = req.body || {};
    if (typeof audio !== 'string' || !audio) return fail(res, 400, 'No audio');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) return fail(res, 400, 'Audio must be a base64 WAV');
    if (!LANGUAGES.includes(language)) return fail(res, 400, 'Language must be one of ' + LANGUAGES.join(', '));
    const rate = Number(samplingRate);
    if (!Number.isInteger(rate) || rate < 8000 || rate > 48000) return fail(res, 400, 'samplingRate must be 8000 to 48000');

    try {
      const text = await transcribe({ audioBase64: audio, language, samplingRate: rate });
      res.json({ data: { text: typeof text === 'string' ? text.trim() : '' } });
    } catch (e) {
      fail(res, 502, 'Could not hear that. Please type instead.');
    }
  });

  // 30. Text to speech through Bhashini: the whole card, in the selected language, for the community to hear.
  // Coordinators only. The audio is handed to the browser and dropped; nothing is stored. With no speech
  // provider the answer is 503 and the browser uses its own speechSynthesis.
  router.post('/speak', async (req, res) => {
    if (req.headers['x-user-role'] !== 'coordinator') return fail(res, 403, 'Coordinators only');
    const { text, language = 'ta' } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return fail(res, 400, 'Please send the words to read');
    if (text.length > 2000) return fail(res, 400, 'Please keep it under 2000 characters');
    if (!LANGUAGES.includes(language)) return fail(res, 400, 'Language must be one of ' + LANGUAGES.join(', '));
    try {
      const out = await withTimeout(speak({ text: text.trim(), language }), draftTimeoutMs * 2);   // two providers may be tried
      if (!out?.audioBase64) throw new Error('no audio');
      res.json({ data: { audioBase64: out.audioBase64, format: out.format || 'wav', samplingRate: out.samplingRate || null, source: out.source || 'bhashini' } });
    } catch (e) {
      fail(res, 503, 'No voice is available here. The browser can read it instead.');
    }
  });

  return router;
}

module.exports = { bridgeRouter, withTimeout, PROMPT };
