// toWav.js — the 16 kHz mono 16-bit WAV that Bhashini reads.
import { describe, expect, it } from 'vitest';
import { arrayBufferToBase64, encodeWav, TARGET_RATE } from '../src/components/seva/toWav';

const text = (view, at, n) => String.fromCharCode(...new Uint8Array(view.buffer, at, n));

describe('encodeWav', () => {
  it('writes a 44-byte PCM header for 16 000 Hz mono 16-bit', () => {
    const view = new DataView(encodeWav(new Float32Array(16000), TARGET_RATE));
    expect(view.byteLength).toBe(44 + 32000);
    expect(text(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 32000);
    expect(text(view, 8, 4)).toBe('WAVE');
    expect(text(view, 12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);          // PCM
    expect(view.getUint16(22, true)).toBe(1);          // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(28, true)).toBe(32000);      // byte rate
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(32000);
  });

  it('turns samples into 16-bit values and clamps anything outside -1..1', () => {
    const view = new DataView(encodeWav(new Float32Array([0, 1, -1, 0.5, 2, -3])));
    expect([0, 1, 2, 3, 4, 5].map(i => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 16383, 32767, -32768]);
  });

  it('an empty recording is still a valid header', () => {
    expect(encodeWav(new Float32Array(0)).byteLength).toBe(44);
  });
});

describe('arrayBufferToBase64', () => {
  it('matches the standard encoding, also for a buffer bigger than one chunk', () => {
    const bytes = new Uint8Array(100000).map((_, i) => (i * 31) % 256);
    expect(arrayBufferToBase64(bytes.buffer)).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('a real WAV starts with "UklGR" (RIFF) in base64', () => {
    expect(arrayBufferToBase64(encodeWav(new Float32Array(10)))).toMatch(/^UklGR/);
  });
});
