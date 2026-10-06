// U8 / U9 and the WAV conversion in real browsers (Chromium and Firefox, fake microphone).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, loginAs, test, USERS } from './fixtures';

const TO_WAV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/web/src/components/seva/toWav.js')
  .split(path.sep).join('/');

async function openPostNeed(page) {
  await loginAs(page, USERS.coordinator);
  await page.goto('/coordinator/post-need');
  return page.getByLabel('What does the community need?');
}

test('toWav: a real recording format is decoded and resampled to a 16 kHz mono WAV', async ({ page }) => {
  await page.goto('/login');
  const out = await page.evaluate(async modulePath => {
    const m = await import(`/@fs/${modulePath}`);
    // 1 second of a 440 Hz tone at 44.1 kHz, as a WAV the browser can decode
    const tone = new Float32Array(44100).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / 44100));
    const input = new Blob([m.encodeWav(tone, 44100)], { type: 'audio/wav' });
    const wav = await m.blobToWav(input);
    const view = new DataView(wav);
    return { rate: view.getUint32(24, true), channels: view.getUint16(22, true), samples: view.getUint32(40, true) / 2,
      riff: String.fromCharCode(...new Uint8Array(wav, 0, 4)), peak: Math.max(...new Int16Array(wav, 44).map(Math.abs)) };
  }, TO_WAV.replace(/^\//, ''));
  expect(out.riff).toBe('RIFF');
  expect(out.rate).toBe(16000);
  expect(out.channels).toBe(1);
  expect(Math.abs(out.samples - 16000)).toBeLessThanOrEqual(2);
  expect(out.peak).toBeGreaterThan(10000);                                           // the tone survived the resampling
});

test('U8: tap the mic, speak, tap stop → the words appear in the box', async ({ page }) => {
  let sent;
  await page.route('**/api/bridge/transcribe', async route => {
    sent = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { text: 'வணக்கம் நண்பர்களே' } }) });
  });
  const box = await openPostNeed(page);
  await box.fill('Saturday:');
  await page.getByRole('button', { name: 'Speak instead of typing' }).click();
  await expect(page.getByRole('button', { name: 'Stop and add the words' })).toBeVisible();
  await expect(page.getByText('Listening… tap stop when you finish.')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Stop and add the words' }).click();
  await expect(box).toHaveValue('Saturday: வணக்கம் நண்பர்களே', { timeout: 10000 });

  expect(sent.language).toBe('ta');
  expect(sent.samplingRate).toBe(16000);
  const wav = Buffer.from(sent.audio, 'base64');
  expect(wav.subarray(0, 4).toString()).toBe('RIFF');
  expect(wav.readUInt32LE(24)).toBe(16000);
  expect(wav.readUInt16LE(22)).toBe(1);
  expect(wav.length).toBeGreaterThan(44 + 16000);                                    // about a second or more of audio
  await expect(page.getByRole('button', { name: 'Speak instead of typing' })).toBeEnabled();
});

test('B14 end to end: with no Bhashini keys the real bridge says 502, and the box is left as it was', async ({ page }) => {
  test.info().annotations.push({ type: 'expected-http-error' });
  let dialogs = 0;
  page.on('dialog', d => { dialogs += 1; d.dismiss(); });
  const box = await openPostNeed(page);
  await box.fill('typed first');
  const answer = page.waitForResponse('**/api/bridge/transcribe');
  await page.getByRole('button', { name: 'Speak instead of typing' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Stop and add the words' }).click();
  expect((await answer).status()).toBe(502);
  await expect(page.getByRole('button', { name: 'Speak instead of typing' })).toBeEnabled();
  await expect(box).toHaveValue('typed first');
  expect(dialogs).toBe(0);
});

test('U9: refusing the microphone → no popup, the text box still works', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
  let dialogs = 0;
  page.on('dialog', d => { dialogs += 1; d.dismiss(); });
  const box = await openPostNeed(page);
  await page.getByRole('button', { name: 'Speak instead of typing' }).click();
  await expect(page.getByRole('button', { name: 'Speak instead of typing' })).toBeEnabled();
  await box.fill('I will type it instead');
  await expect(box).toHaveValue('I will type it instead');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(dialogs).toBe(0);
});

test('a browser that cannot record shows no mic, only the text box', async ({ page }) => {
  await page.addInitScript(() => { delete window.MediaRecorder; });
  const box = await openPostNeed(page);
  await expect(box).toBeVisible();
  await expect(page.getByRole('button', { name: 'Speak instead of typing' })).toHaveCount(0);
});

test('the diary never offers the mic', async ({ page }) => {
  await loginAs(page, USERS.seededVolunteer);
  await page.goto('/reflect/650000000000000000000041');
  await expect(page.getByLabel('Your answer')).toBeVisible();
  await expect(page.getByRole('button', { name: /Speak/ })).toHaveCount(0);
});
