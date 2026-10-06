// scripts/ui-test.js — screen tests S1–S15 from PERSON_A_LEAD.md section 8.2, in real Chrome
// at 390 px (phone layout), or at 1440 px with --desktop (sidebar layout).
//   npm run test:ui                                   local: reseeds, then tests http://localhost:5174
//   npm run test:ui:desktop                           the same at 1440 px
//   WEB=https://your-site.vercel.app node scripts/ui-test.js           deployed (seed Atlas first)
// Needs the backend and the web app running, and Google Chrome installed (CHROME_PATH to override).
// Every screen is also checked for sideways scrolling and console errors.
const { chromium } = require('playwright-core');

const WEB = (process.env.WEB || 'http://localhost:5174').replace(/\/$/, '');
const DESKTOP = process.argv.includes('--desktop');
const VIEWPORT = DESKTOP ? { width: 1440, height: 900 } : { width: 390, height: 844 };
const results = [];
const consoleErrors = [];

function check(name, pass, detail = '', waitsForB = false) {
  const state = pass ? 'PASS' : waitsForB ? 'WAIT' : 'FAIL';
  results.push(state);
  console.log(`${state}  ${name}${pass ? '' : `  -> ${detail}`}`);
}

async function attempt(name, fn) {
  try { await fn(); } catch (e) { check(name, false, e.message.split('\n')[0]); }
}

let browser;
async function person(who) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`${who}: ${m.text()}`); });
  page.on('pageerror', e => consoleErrors.push(`${who}: ${e.message}`));
  if (who) {
    await page.goto(WEB + '/login');
    await page.getByRole('button', { name: new RegExp(who) }).click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'));
  }
  return page;
}

const overflowing = [];
async function fits(page) {
  await page.waitForLoadState('networkidle');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (wide) overflowing.push(new URL(page.url()).pathname);
}

async function reloadUntil(page, locator, tries = 3) {
  for (let i = 0; i < tries; i++) {
    if (await locator.isVisible()) return true;
    await page.reload();
    await page.waitForLoadState('networkidle');
  }
  return locator.isVisible();
}

(async () => {
  const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
  browser = await chromium.launch(launch);
  console.log(`Testing ${WEB} at ${VIEWPORT.width} px\n`);

  // S1 — a fresh visit goes to /login and lists the demo users
  const meera = await person('');
  await attempt('S1  opens on /login with demo users', async () => {
    await meera.goto(WEB + '/');
    await meera.waitForURL('**/login');
    await meera.getByText('Meera Krishnan').waitFor();
    await fits(meera);
    check('S1  opens on /login with demo users', true);
  });

  // S2 — log in, Home loads fast, all 5 tabs work
  await attempt('S2  home loads, 5 tabs work', async () => {
    const t0 = Date.now();
    await meera.getByRole('button', { name: /Meera/ }).click();
    await meera.getByText('Begin Your Seva Journey').waitFor();
    const ms = Date.now() - t0;
    await fits(meera);
    const tabs = [['Opportunities', '/opportunities'], ['My Seva', '/my-seva'], ['Wisdom', '/wisdom'], ['Profile', '/profile'], ['Home', '/']];
    for (const [label, path] of tabs) {
      await meera.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label }).click();
      await meera.waitForURL(u => u.pathname === path);
      await fits(meera);
    }
    check('S2  home loads, 5 tabs work', ms < 3000, `home took ${ms} ms`);
  });

  // S4 — three questions, at most three cards, each with a reason
  await attempt('S4  needs search', async () => {
    await meera.goto(WEB + '/opportunities?day=Saturday&maxKm=5&interest=teaching');
    await meera.getByText('Why this fits').first().waitFor();
    await fits(meera);
    const cards = await meera.getByText('Why this fits').count();
    check('S4  needs search', cards >= 1 && cards <= 3, `${cards} cards`);
  });

  // S5 — the need card: 4 parts, Verified, one action, no Register
  await attempt('S5  need card', async () => {
    await meera.getByText('Spoken English Circle').click();
    await meera.getByRole('link', { name: /Visit and listen/ }).waitFor();
    await fits(meera);
    const parts = ['What we want', 'How to serve us well', 'What you will learn', 'Rhythm'];
    const missing = [];
    for (const p of parts) if (!(await meera.getByRole('heading', { name: p }).isVisible())) missing.push(p);
    const register = await meera.getByText(/register/i).count();
    const verified = await meera.getByText('Verified').filter({ visible: true }).isVisible();
    check('S5  need card', !missing.length && verified && register === 0, `missing ${missing}, verified ${verified}, register ${register}`);
  });

  check('S6  "Why?" popup', false, 'WhyLink is a stand-in until Person B is integrated', true);

  // S7 — briefing, request, what I heard, yes -> waiting
  await attempt('S7  listen flow', async () => {
    await meera.getByRole('link', { name: /Visit and listen/ }).click();
    await meera.getByRole('button', { name: 'I understand' }).click();
    await meera.getByRole('button', { name: 'Request a visit' }).click();
    await meera.getByPlaceholder(/I thought they wanted/).fill('They wanted to speak first, and only then read.');
    await meera.getByRole('button', { name: 'Save what I heard' }).click();
    await meera.getByRole('button', { name: 'Yes', exact: true }).click();
    await meera.getByText('Waiting for the community’s answer').waitFor();
    await fits(meera);
    check('S7  listen flow', true);
  });

  // S8 — the coordinator says yes in another browser; the volunteer sees Commit
  const lakshmi = await person('Lakshmi');
  await attempt('S8  coordinator yes -> Commit appears', async () => {
    await lakshmi.getByRole('button', { name: /Yes, welcome/ }).click();
    await lakshmi.getByText('No visits waiting.').waitFor();
    await fits(lakshmi);
    const shown = await reloadUntil(meera, meera.getByRole('link', { name: 'Commit' }));
    check('S8  coordinator yes -> Commit appears', shown, 'Commit button did not appear');
  });

  // S9 — commit for 4 weeks
  await attempt('S9  commit', async () => {
    await meera.getByRole('link', { name: 'Commit' }).click();
    await meera.getByPlaceholder('I want to…').fill('I want to learn to listen before I teach.');
    await fits(meera);
    await meera.getByRole('button', { name: 'Begin 4 weeks' }).click();
    await meera.waitForURL('**/my-seva');
    await meera.getByText('Week 1').first().waitFor();
    check('S9  commit', await meera.getByText('of 4').first().isVisible(), '"of 4" not shown');
  });

  // S3 — refresh on /my-seva keeps the page and the login
  await attempt('S3  refresh on /my-seva', async () => {
    await meera.reload();
    await meera.getByText('Spoken English Circle').first().waitFor();
    check('S3  refresh on /my-seva', meera.url().endsWith('/my-seva'), meera.url());
  });

  // S10 — nothing that counts or ranks
  await attempt('S10 no hours, points or rank', async () => {
    const text = await meera.locator('main').innerText();
    const bad = text.match(/\b(hours?|points?|rank\w*|leaderboard|score)\b/i);
    check('S10 no hours, points or rank', !bad, `found "${bad?.[0]}"`);
  });

  // S11 — "I cannot come this week", and a circle member covers it
  const kavya = await person('Kavya');
  await attempt('S11 absence and cover', async () => {
    await meera.getByRole('button', { name: 'I cannot come this week' }).click();
    await meera.getByText('cannot come', { exact: true }).first().waitFor();
    await kavya.goto(WEB + '/my-seva');
    await kavya.getByRole('button', { name: 'I will cover' }).click();
    await kavya.getByText(/cannot come in week/).waitFor({ state: 'detached' });
    await fits(kavya);
    await meera.reload();
    await meera.getByText('by Kavya').waitFor();
    check('S11 absence and cover', true);
  });

  // S12 — time travel to week 4 and send the invitation; the volunteer sees 3 choices
  await attempt('S12 time travel + invitation', async () => {
    await lakshmi.reload();
    const card = lakshmi.locator('li', { hasText: 'Meera Krishnan' }).filter({ has: lakshmi.getByRole('combobox') });
    await card.getByRole('combobox').selectOption({ label: 'Week 4' });
    await card.getByRole('button', { name: 'Go' }).click();
    await card.getByText('Week 4 of 4').waitFor();
    await card.getByRole('textbox').fill('The students asked if you are coming next month.');
    await card.getByRole('button', { name: 'Send invitation' }).click();
    await card.getByText(/Invitation sent/).waitFor();
    await fits(lakshmi);
    await meera.reload();
    await meera.getByText('An invitation from the community').filter({ visible: true }).waitFor();
    const choices = await Promise.all(['Continue for 4 more weeks', 'Pause', 'Finish']
      .map(n => meera.getByRole('button', { name: n }).isVisible()));
    await fits(meera);
    check('S12 time travel + invitation', choices.every(Boolean), `choices ${choices}`);
  });

  // S13 — Continue -> Week 4 of 8
  await attempt('S13 continue', async () => {
    await meera.getByRole('button', { name: 'Continue for 4 more weeks' }).click();
    await meera.getByText('of 8').first().waitFor();
    check('S13 continue', await meera.getByText('Week 4').first().isVisible(), 'Week 4 not shown');
  });

  // S14 — Home shows real weeks and no photo of people
  await attempt('S14 home continue card', async () => {
    await meera.goto(WEB + '/');
    await meera.getByText('Week 4 of 8').waitFor();
    const images = await meera.locator('main img').count();
    check('S14 home continue card', images === 0, `${images} <img> on Home`);
  });

  // S15 — another volunteer does not see Meera's commitment
  await attempt('S15 other volunteer sees only their own', async () => {
    await meera.goto(WEB + '/profile');
    await meera.getByRole('button', { name: 'Log out' }).click();
    await meera.waitForURL('**/login');
    await meera.getByRole('button', { name: /Rahul/ }).click();
    await meera.waitForURL(u => !u.pathname.startsWith('/login'));
    await meera.goto(WEB + '/my-seva');
    await meera.getByText('No seva yet').waitFor();
    const leak = await meera.getByText('Spoken English Circle').count();
    check('S15 other volunteer sees only their own', leak === 0, 'saw Meera\'s commitment');
  });

  // a volunteer typing /coordinator is sent home
  await attempt('X1  volunteer blocked from /coordinator', async () => {
    await meera.goto(WEB + '/coordinator');
    await meera.waitForURL(u => u.pathname === '/');
    check('X1  volunteer blocked from /coordinator', true);
  });

  check('D2  no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  check(`--  every screen fits ${VIEWPORT.width} px`, overflowing.length === 0, `too wide: ${[...new Set(overflowing)].join(', ')}`);

  await browser.close();
  const count = st => results.filter(x => x === st).length;
  console.log(`\n${count('PASS')} passed, ${count('FAIL')} failed, ${count('WAIT')} waiting for Person B's services`);
  process.exit(count('FAIL') ? 1 : 0);
})().catch(async e => { console.error(e); await browser?.close(); process.exit(1); });
