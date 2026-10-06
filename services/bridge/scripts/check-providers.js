// Run: npm run check   (from services/bridge, with a filled .env)
// Optional: npm run check -- path/to/tamil-16khz.wav   to also test speech to text.
// Prints only results and timings, never the keys.
const fs = require('fs');
const { callLLM } = require('../src/providers/llm');
const { transcribe, translate, speak } = require('../src/providers/language');

const PROMPT = `You turn a community coordinator's words into a need card. Return ONLY JSON.
Describe the GROUP, never one person. No names, ages, income, caste, religion or health details.`;

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    console.log(`PASS  ${name}  (${Date.now() - t0} ms)\n      ${result}`);
  } catch (e) {
    console.log(`FAIL  ${name}  (${Date.now() - t0} ms)\n      ${e.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  await step('Groq draft-need', async () => {
    const raw = await callLLM(PROMPT,
      '12 students of class 6 to 8 want help reading English aloud, Saturday mornings at the government school in Kanchipuram', 'en');
    const draft = JSON.parse(raw);
    return `title="${draft.title}", groupSize=${draft.groupSize}, keys=${Object.keys(draft).length}`;
  });

  await step('Bhashini translate ta -> en', () =>
    translate({ text: 'சனிக்கிழமை காலை பள்ளியில் குழந்தைகளுக்கு ஆங்கிலம் படிக்க உதவி வேண்டும்', from: 'ta' }));

  await step('Bhashini text to speech (ta)', async () => {
    const out = await speak({ text: 'வணக்கம். இது ஒரு சோதனை.', language: 'ta' });
    return `${out.format}, ${Math.round(out.audioBase64.length * 3 / 4 / 1024)} KB of audio (not saved)`;
  });

  const wav = process.argv[2];
  if (wav) {
    await step('Bhashini speech to text (ta)', () =>
      transcribe({ audioBase64: fs.readFileSync(wav).toString('base64'), language: 'ta' }));
  } else {
    console.log('SKIP  Bhashini speech to text (pass a 16 kHz Tamil .wav file to test it)');
  }
})();
