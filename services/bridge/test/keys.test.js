// Test B10: provider keys are never in git or the frontend, and no frontend code talks to a provider.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scan } = require('../scripts/scan-keys');

const WEB_SRC = path.resolve(__dirname, '../../../apps/web/src');

function* sourceFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(full);
    else if (/\.(jsx?|css|json|html)$/.test(entry.name)) yield full;
  }
}

describe('B10: keys stay in the bridge', () => {
  it('the scanner finds a planted key and ignores the .env file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'));
    fs.writeFileSync(path.join(dir, 'bundle.js'), 'const k = "gsk_TESTKEY1234567890";');
    const { leaks } = scan({ env: { GROQ_API_KEY: 'gsk_TESTKEY1234567890' }, roots: [dir] });
    assert.equal(leaks.length, 1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('the real keys (if set in .env) are nowhere in the repo', () => {
    const { leaks } = scan();
    assert.deepEqual(leaks, []);
  });

  it('no frontend file calls Groq or Bhashini or mentions their keys', () => {
    for (const file of sourceFiles(WEB_SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /groq\.com|bhashini\.gov|ulcacontrib|dhruva|GROQ_API_KEY|BHASHINI_|ulcaApiKey/i, file);
    }
  });
});
