// Test B10: the Groq and Bhashini keys must never be in git or in the built frontend.
// Run: npm run scan-keys   (from services/bridge, or from person-b with `npm run scan-keys`)
// Reads the keys from services/bridge/.env (or the environment) and searches for their first 8 characters.
const fs = require('fs');
const path = require('path');

const BRIDGE = path.resolve(__dirname, '..');
const ROOTS = [path.resolve(BRIDGE, '../../..')];        // the whole repo, built frontends included
const SKIP_DIRS = new Set(['node_modules', '.git']);
const SKIP_FILES = new Set([path.join(BRIDGE, '.env')]);  // the one place a key may live (git ignores it)
const KEY_NAMES = ['GROQ_API_KEY', 'BHASHINI_USER_ID', 'BHASHINI_ULCA_API_KEY'];

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) yield* files(full); }
    else if (!SKIP_FILES.has(full) && !/\.(env|env\.local)$/.test(entry.name)) yield full;
  }
}

function scan({ env = { ...readEnvFile(path.join(BRIDGE, '.env')), ...process.env }, roots = ROOTS } = {}) {
  const prefixes = KEY_NAMES.map(name => [name, (env[name] || '').slice(0, 8)]).filter(([, p]) => p.length === 8);
  const leaks = [];
  for (const root of roots)
    for (const file of files(root)) {
      const stat = fs.statSync(file);
      if (stat.size > 10 * 1024 * 1024) continue;
      const text = fs.readFileSync(file, 'latin1');
      for (const [name, prefix] of prefixes) if (text.includes(prefix)) leaks.push({ name, file });
    }
  return { checked: prefixes.map(([name]) => name), leaks };
}

if (require.main === module) {
  const { checked, leaks } = scan();
  if (!checked.length) console.log('SKIP  no keys are set in services/bridge/.env, so there is nothing to look for');
  else if (!leaks.length) console.log(`PASS  ${checked.join(', ')} not found anywhere outside services/bridge/.env`);
  for (const { name, file } of leaks) console.log(`FAIL  ${name} found in ${file}`);
  process.exitCode = leaks.length ? 1 : 0;
}

module.exports = { scan };
