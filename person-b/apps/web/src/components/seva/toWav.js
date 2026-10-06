// Bhashini cannot read the browser's WebM/Ogg/MP4 recording, so turn it into what it can read:
// a 16 000 Hz, mono, 16-bit PCM WAV (44-byte header + samples).
export const TARGET_RATE = 16000;

// recorded Blob → ArrayBuffer of a WAV file
export async function blobToWav(blob, sampleRate = TARGET_RATE) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  const ctx = new AudioCtx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ctx.close?.();
  }

  // An offline context with one channel at 16 kHz resamples and mixes down to mono while it renders
  const length = Math.max(1, Math.ceil(decoded.duration * sampleRate));
  const offline = new OfflineCtx(1, length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), sampleRate);
}

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

// Float32 samples (-1..1), one channel → 16-bit PCM WAV
export function encodeWav(samples, sampleRate = TARGET_RATE) {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);                  // fmt chunk size
  view.setUint16(20, 1, true);                   // PCM
  view.setUint16(22, 1, true);                   // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);      // byte rate = rate × 1 channel × 2 bytes
  view.setUint16(32, 2, true);                   // block align
  view.setUint16(34, 16, true);                  // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;                          // keeps String.fromCharCode under the argument limit
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}
