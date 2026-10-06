// scripts/screenshots.mjs — a real screenshot of every SevaSetu screen, from the locally running app,
// with real seeded data. Reseeds first; logs in through the API; builds each state through the API.
//   node scripts/screenshots.mjs          (needs `npm run dev` running and Google Chrome installed)
//   GW=… WEB=… CHROME_PATH=… node scripts/screenshots.mjs
// Output: screenshots/NN-role-screen.png and screenshots/index.html (a contact sheet).
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ids = require('../seed/ids');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'screenshots');
const GW = (process.env.GW || 'http://localhost:8080').replace(/\/$/, '');
const WEB = (process.env.WEB || 'http://localhost:5174').replace(/\/$/, '');
const SKELETON = '[data-skeleton], [aria-busy="true"]';         // skeleton shapes and busy regions

const shots = [];        // { file, role, title, ok, note }
const problems = [];

// ---------- API ----------
async function call(method, url, { token, body } = {}) {
  const res = await fetch(GW + url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${json?.error?.message || ''}`);
  return json?.data;
}
const login = userId => call('POST', '/api/auth/demo-login', { body: { userId } });

// ---------- browser ----------
let browser;
async function pageAs(session) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: 'light' });
  if (session) {
    // the app keeps who is logged in under this key (zustand persist)
    const state = JSON.stringify({ state: { token: session.token, user: session.user }, version: 0 });
    await context.addInitScript(s => localStorage.setItem('sevasetu-auth', s), state);
  }
  const page = await context.newPage();
  page.on('pageerror', e => problems.push(`page error: ${e.message}`));
  return page;
}

// network idle, fonts loaded, no skeleton on screen, no toast
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '[data-toast]{display:none!important}' });
  await page.waitForFunction(sel => ![...document.querySelectorAll(sel)].some(el => el.getClientRects().length > 0), SKELETON, { timeout: 15000 });
  await page.waitForTimeout(250);               // let the 150 ms fade finish
}

async function capture(page, n, role, name, title, { full = true, locator, ready } = {}) {
  const file = `${String(n).padStart(2, '0')}-${role}-${name}.png`;
  try {
    if (ready) await ready();
    await settle(page);
    const target = locator ? page.locator(locator).first() : page;
    if (locator) await target.scrollIntoViewIfNeeded();
    // a full page is shot as one tall phone screen, so fixed bars (nav, action bar) sit at the real bottom
    if (!locator && full) {
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: 390, height: Math.max(844, height) });
      await settle(page);
    }
    await target.screenshot({ path: path.join(OUT, file) });
    await page.setViewportSize({ width: 390, height: 844 });
    const loaders = await page.locator(SKELETON).filter({ visible: true }).count();
    shots.push({ file, role, title, ok: loaders === 0, note: loaders ? 'a loader was still visible' : '' });
    console.log(`${loaders ? 'WARN' : 'OK  '}  ${file}`);
  } catch (e) {
    shots.push({ file, role, title, ok: false, note: e.message.split('\n')[0] });
    console.log(`FAIL  ${file}  -> ${e.message.split('\n')[0]}`);
  }
}

const skip = (n, role, name, title, why) => {
  const file = `${String(n).padStart(2, '0')}-${role}-${name}.png`;
  shots.push({ file, role, title, ok: false, note: why, missing: true });
  console.log(`SKIP  ${file}  -> ${why}`);
};

// ---------- run ----------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
console.log('Reseeding both databases…');
execSync('npm run seed', { cwd: ROOT, stdio: 'ignore' });

const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
browser = await chromium.launch(launch);

const meera = await login(ids.users.newVolunteer);
const arjun = await login(ids.users.seededVolunteer);
const lakshmi = await login(ids.users.coordinator);
const rahul = await login(ids.users.otherVolunteer);
const NEED = ids.needs.need2;                         // "Spoken English Circle", Saturday, 3 km
const ARJUN_C = ids.commitments.seeded;

try {
  // ===== the new volunteer =====
  let p = await pageAs(null);
  await p.goto(`${WEB}/login`);
  await capture(p, 1, 'volunteer', 'login', 'Login: pick a demo user', { ready: () => p.getByText('Meera Krishnan').waitFor() });
  await p.context().close();

  p = await pageAs(meera);
  await p.goto(`${WEB}/`);
  await capture(p, 2, 'volunteer', 'home', 'Home', { ready: () => p.getByRole('link', { name: 'Find a Need' }).waitFor() });

  await p.goto(`${WEB}/opportunities?day=Saturday&maxKm=5&interest=teaching`);
  await capture(p, 3, 'volunteer', 'needs-questions', 'Needs: the three questions', { full: false, ready: () => p.getByText('Which day can you give?').waitFor() });
  await capture(p, 4, 'volunteer', 'needs-results', 'Needs: results with "why this fits you"', { ready: () => p.getByText('Spoken English Circle').waitFor() });

  await p.goto(`${WEB}/needs/${NEED}`);
  await capture(p, 5, 'volunteer', 'need-card', 'Need card', { ready: () => p.getByText('In the community’s words').waitFor() });

  await capture(p, 6, 'volunteer', 'why-sheet', '"Why?" sheet on the need card', {
    full: false,
    ready: async () => {
      await p.getByRole('button', { name: /Why/ }).filter({ visible: true }).first().click();
      await p.getByRole('dialog').getByText('What SevaSetu does').waitFor();
    },
  });

  await p.goto(`${WEB}/needs/${NEED}/listen`);
  await capture(p, 7, 'volunteer', 'listen-briefing', 'Listen First: guest briefing with the Listening Guide', {
    ready: () => p.locator('#listening-guide + p + ol li').nth(2).waitFor(),
  });

  const visit = await call('POST', `/api/needs/${NEED}/visits`, { token: meera.token });
  await p.goto(`${WEB}/needs/${NEED}/listen`);
  await capture(p, 8, 'volunteer', 'listen-heard', 'Listen First: "What did you hear?" filled in', {
    ready: () => p.getByPlaceholder(/I thought they wanted/).fill('I thought they wanted grammar lessons, but they told me they want to talk about cricket and films, in English, without being corrected all the time.'),
  });

  await call('PATCH', `/api/visits/${visit._id}/heard`, { token: meera.token, body: { text: 'I thought they wanted grammar lessons, but they want to talk about cricket and films, in English, without being corrected all the time.' } });
  await p.goto(`${WEB}/needs/${NEED}/listen`);
  await capture(p, 9, 'volunteer', 'listen-waiting', 'Listen First: waiting for the community’s answer', {
    ready: () => p.getByText('Waiting for the community’s answer').waitFor(),
  });

  // a second volunteer's visit stays pending, for the coordinator's screens (20 and 25)
  const pending = await call('POST', `/api/needs/${ids.needs.need5}/visits`, { token: rahul.token });
  await call('PATCH', `/api/visits/${pending._id}/heard`, { token: rahul.token, body: { text: 'The elders want to tell their own stories first, and only then walk in the garden.' } });

  await call('PATCH', `/api/visits/${visit._id}/decision`, { token: lakshmi.token, body: { yes: true, text: 'They would like you to come back.' } });
  await p.goto(`${WEB}/commit/${visit._id}`);
  await capture(p, 10, 'volunteer', 'commit', 'Commit: sentence and Sankalpa filled in', {
    ready: async () => {
      await p.waitForFunction(() => document.querySelector('textarea')?.value.startsWith('I will come every'));
      await p.getByPlaceholder('I hope to learn…').fill('To listen more than I speak.');
    },
  });
  await p.context().close();

  // ===== the seeded volunteer, week 2 of 4 =====
  p = await pageAs(arjun);
  await p.goto(`${WEB}/my-seva`);
  await capture(p, 11, 'volunteer', 'my-seva', 'My Seva: week view with the four yogas and the circle', {
    ready: () => p.getByRole('list', { name: 'Your four steps' }).waitFor(),
  });

  await p.goto(`${WEB}/my-seva/${ARJUN_C}/silent`);
  await capture(p, 12, 'volunteer', 'silent-seva', 'Silent Seva', { full: false, ready: () => p.getByText('Put the phone away.').waitFor() });

  await p.goto(`${WEB}/reflect/${ARJUN_C}`);
  await capture(p, 13, 'volunteer', 'diary', 'Diary: this week’s question', {
    ready: () => p.getByRole('heading', { name: 'What did someone tell you that surprised you?' }).waitFor(),
  });
  await capture(p, 14, 'volunteer', 'diary-hard-day', 'Diary: Hard Day mode', {
    ready: async () => {
      await p.locator('#diary-text').fill('Nobody wanted to read today. I did not know what to do with the silence.');
      await p.getByText('This was a hard day').click();
      await p.getByText('What was in your hands today, and what was not?').first().waitFor();
    },
  });

  await p.goto(`${WEB}/wisdom`);
  await capture(p, 15, 'volunteer', 'wisdom', 'Wisdom tab', { ready: () => p.getByRole('heading', { name: 'Wisdom', level: 1 }).waitFor() });

  const verified = await call('GET', '/api/wisdom', { token: arjun.token });
  if (!verified.length) {
    skip(16, 'volunteer', 'teaching-finder', 'Teaching Finder with a result',
      'no quote in seed/wisdom.json is verified yet, so the Teaching Finder is hidden (by design)');
  } else {
    await capture(p, 16, 'volunteer', 'teaching-finder', 'Teaching Finder with a result', {
      ready: async () => {
        await p.getByLabel(/Describe what happened/).fill('I had to wait a long time today, and I got impatient.');
        await p.getByRole('button', { name: /Find a teaching/ }).click();
        await p.getByTestId('found-teaching').waitFor();
      },
    });
  }

  await p.goto(`${WEB}/profile`);
  await capture(p, 17, 'volunteer', 'profile', 'Profile', { ready: () => p.getByRole('heading', { name: 'Arjun Raman' }).waitFor() });

  // jump Arjun's seva to week 4: his own diary words for weeks 2 and 4, then the community's invitation
  await call('POST', '/api/reflect/entries', { token: arjun.token, body: { commitmentId: ARJUN_C, week: 2, text: 'I waited, and he finished the sentence himself.' } });
  await call('POST', '/api/demo/advance', { token: lakshmi.token, body: { commitmentId: ARJUN_C, toWeek: 4 } });
  await call('POST', '/api/reflect/entries', { token: arjun.token, body: { commitmentId: ARJUN_C, week: 4, text: 'They read to me today. I only listened, and that was the gift.' } });
  await call('POST', `/api/commitments/${ARJUN_C}/invitation`, { token: lakshmi.token, body: { text: 'The children asked if you are coming next month. We would like that very much.' } });

  await p.goto(`${WEB}/reflect/${ARJUN_C}/then-and-now`);
  await capture(p, 18, 'volunteer', 'then-and-now', 'Then and Now, with the Sankalpa', { ready: () => p.getByText('Your Sankalpa').waitFor() });

  await p.goto(`${WEB}/my-seva`);
  await capture(p, 19, 'volunteer', 'invitation', 'My Seva: the community’s invitation', {
    locator: 'text=An invitation from the community >> xpath=ancestor::div[contains(@class,"rounded-2xl")][1]',
    ready: () => p.getByText('An invitation from the community').first().waitFor(),
  });
  await p.context().close();

  // ===== the coordinator =====
  p = await pageAs(lakshmi);
  await p.goto(`${WEB}/coordinator`);
  await capture(p, 20, 'coordinator', 'dashboard', 'Dashboard with a pending listen visit', { ready: () => p.getByRole('button', { name: /Yes, welcome/ }).waitFor() });
  await capture(p, 21, 'coordinator', 'promise-kept', 'Promise Kept grid', {
    locator: 'section:has(h2:text-is("Promise Kept"))',
    ready: () => p.getByText('The children were never left waiting.').waitFor(),
  });
  await capture(p, 25, 'coordinator', 'updated-after-listening', 'Updated after listening: the suggestion waiting for approval', {
    locator: 'section:has(h2:text-is("Updated after listening"))',
    ready: () => p.getByTestId('listening-update').first().getByRole('button', { name: /Add to the card/ }).waitFor(),
  });
  await capture(p, 26, 'coordinator', 'community-check-in', 'Community Check-in', {
    locator: '[data-testid="check-in"]',
    ready: async () => {
      const form = p.getByTestId('check-in').first();
      await form.getByLabel('Is this helping?').fill('Yes. The children read aloud without being asked now.');
      await form.getByLabel('Should anything change?').fill('Start at 10:30, after the morning assembly.');
      await form.getByLabel('What can the group now do on their own?').fill('Choose their own books from the library.');
    },
  });

  await p.goto(`${WEB}/coordinator/post-need`);
  const words = p.locator('#need-words');
  await capture(p, 22, 'coordinator', 'post-need-text', 'Post a Need: text entered', {
    ready: async () => {
      await p.getByText('English', { exact: true }).click();
      await words.fill('12 students of class 6 to 8 want help reading English aloud, Saturday mornings 10:30 to 12 at the government school in Kanchipuram.');
    },
  });
  await capture(p, 23, 'coordinator', 'post-need-draft', 'Post a Need: the draft card', {
    ready: async () => {
      await p.getByRole('button', { name: 'Make draft' }).click();
      await p.locator('#need-title').waitFor({ timeout: 20000 });
    },
  });
  await capture(p, 24, 'coordinator', 'dignity-check', 'Dignity Check: flags and a suggested rewrite', {
    ready: async () => {
      await p.getByRole('button', { name: 'Start again' }).click();
      await words.fill('poor boy Ravi, income 5000');
      await p.getByRole('button', { name: 'Make draft' }).click();
      await p.getByTestId('dignity-check').locator('mark').first().waitFor({ timeout: 20000 });
    },
  });

  await call('POST', `/api/resources/${ids.resources.schoolTablets}/connect`, { token: lakshmi.token, body: { withId: ids.resources.collegeTablets } });
  await p.goto(`${WEB}/coordinator/resources`);
  await capture(p, 27, 'coordinator', 'resource-connect', 'Resource Connect: the matched "we lack" and "we have"', {
    ready: () => p.getByText(/Connected with/).first().waitFor(),
  });
  await p.context().close();

  // ===== one empty state and one error state =====
  p = await pageAs(rahul);
  await p.goto(`${WEB}/my-seva`);
  await capture(p, 28, 'states', 'empty-my-seva', 'Empty state: My Seva before any seva', { ready: () => p.getByText('No seva yet').waitFor() });
  await p.route('**/api/wisdom?**', r => r.abort());
  await p.route('**/api/wisdom', r => r.abort());
  await p.goto(`${WEB}/wisdom`);
  await capture(p, 29, 'states', 'error-wisdom', 'Error state: Wisdom could not load', { ready: () => p.getByRole('alert').first().waitFor() });
  await p.context().close();
} catch (e) {
  problems.push(`stopped early: ${e.message}`);
  console.log(`STOP  ${e.message}`);
} finally {
  await browser.close();
}

// ---------- contact sheet ----------
const ROLES = [['volunteer', 'Volunteer'], ['coordinator', 'Coordinator'], ['states', 'Empty and error states']];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sorted = [...shots].sort((a, b) => a.file.localeCompare(b.file));
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SevaSetu screens</title>
<style>
  body { margin: 0; padding: 24px 16px; background: #FBF6EE; color: #2B1D14; font: 15px/1.5 Inter, system-ui, sans-serif; }
  h1, h2 { font-family: Lora, Georgia, serif; } h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 18px; margin: 32px 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  figure { margin: 0; background: #fff; border: 1px solid #EADFD2; border-radius: 16px; padding: 8px; }
  img { width: 100%; height: auto; border-radius: 8px; display: block; }
  figcaption { font-size: 13px; margin-top: 8px; } .name { color: #7A6A5E; } .bad { color: #B9450C; }
  .missing { aspect-ratio: 390/844; display: grid; place-items: center; text-align: center; padding: 16px; color: #7A6A5E; background: #F4EBDF; border-radius: 8px; }
</style></head><body>
<h1>SevaSetu — every screen</h1><p class="name">390 × 844 at 3×, light. ${sorted.length} screens, captured ${new Date().toLocaleString('en-IN')}.</p>
${ROLES.map(([role, label]) => `<h2>${label}</h2><div class="grid">${sorted.filter(s => s.role === role).map(s => `
<figure>${s.missing ? `<div class="missing">Not captured<br>${esc(s.note)}</div>` : `<a href="${s.file}"><img src="${s.file}" alt="${esc(s.title)}" loading="lazy"></a>`}
<figcaption><b>${esc(s.title)}</b><br><span class="name">${s.file}</span>${s.ok ? '' : `<br><span class="bad">${esc(s.note)}</span>`}</figcaption></figure>`).join('')}</div>`).join('\n')}
</body></html>`;
writeFileSync(path.join(OUT, 'index.html'), html);

const bad = shots.filter(s => !s.ok);
console.log(`\n${shots.length - bad.length} of ${shots.length} screens captured cleanly. Contact sheet: screenshots/index.html`);
if (bad.length || problems.length) {
  console.log('\nProblems:');
  for (const s of bad) console.log(`  ${s.file}: ${s.note}`);
  for (const m of problems) console.log(`  ${m}`);
}
