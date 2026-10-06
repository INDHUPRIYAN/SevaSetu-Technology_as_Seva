// scripts/ui-test.js — screen tests S1–S15 from PERSON_A_LEAD.md section 8.2, in real Chrome
// at 390 px (phone layout), or at 1440 px with --desktop (sidebar layout).
//   npm run test:ui                                   local: reseeds, then tests http://localhost:5174
//   npm run test:ui:desktop                           the same at 1440 px
//   WEB=https://your-site.vercel.app node scripts/ui-test.js           deployed (seed Atlas first)
// Needs the backend and the web app running, and Google Chrome installed (CHROME_PATH to override).
// Every screen is also checked for sideways scrolling and console errors.
const { chromium } = require('playwright-core');
const ids = require('../seed/ids');

const WEB = (process.env.WEB || 'http://localhost:5174').replace(/\/$/, '');
const DESKTOP = process.argv.includes('--desktop');
const VIEWPORT = DESKTOP ? { width: 1440, height: 900 } : { width: 390, height: 844 };
const results = [];
const consoleErrors = [];

function check(name, pass, detail = '') {
  const state = pass ? 'PASS' : 'FAIL';
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

  // U1, U3 — "Seva Wisdom for Today" on Home with its source; Read More opens Wisdom; chips filter
  await attempt('U1  wisdom card + Wisdom page', async () => {
    const card = meera.locator('section', { hasText: 'Seva Wisdom for Today' });
    await card.waitFor();
    const source = await card.getByText(/Complete Works/).count();
    await card.getByRole('link', { name: /Read More/ }).click();
    await meera.waitForURL('**/wisdom');
    await meera.locator('blockquote').first().waitFor();
    const all = await meera.locator('blockquote').count();
    const filtered = meera.waitForResponse(r => r.url().includes('/api/wisdom?theme=patience'));
    await meera.getByRole('button', { name: 'Patience' }).click();
    await filtered;
    await meera.waitForFunction(n => document.querySelectorAll('blockquote').length < n, all, { polling: 200 });
    await fits(meera);
    check('U1  wisdom card + Wisdom page', source > 0, 'no source on the wisdom card');
  });

  // Demo step 2 — the coordinator posts a need: privacy warnings, AI or fallback draft, read-back, publish
  const lakshmi = await person('Lakshmi');
  let posted = null;
  await attempt('U13 post a need (draft, warnings, read-back, publish)', async () => {
    await lakshmi.goto(WEB + '/coordinator/post-need');
    await lakshmi.getByText('English', { exact: true }).click();
    const words = lakshmi.locator('#need-words');
    await words.fill('Ravi, a poor boy, his father\'s income is Rs 5000, wants help with English on Saturday.');
    await lakshmi.getByRole('button', { name: 'Make draft' }).click();
    await lakshmi.getByTestId('privacy-warnings').waitFor({ timeout: 20000 });
    const warnings = await lakshmi.getByTestId('privacy-warnings').locator('li').count();
    await lakshmi.getByRole('button', { name: 'Start again' }).click();
    await words.fill('12 students of class 6 to 8 want help reading English aloud, Saturday mornings 10:30 to 12 at the government school in Kanchipuram.');
    await lakshmi.getByRole('button', { name: 'Make draft' }).click();
    await lakshmi.locator('#need-title').waitFor({ timeout: 20000 });
    await fits(lakshmi);
    const publish = lakshmi.getByRole('button', { name: 'Publish need' });
    const lockedBeforeTick = await publish.isDisabled();
    posted = {
      title: await lakshmi.locator('#need-title').inputValue(),
      day: await lakshmi.locator('#need-day').inputValue(),
      tag: (await lakshmi.locator('#need-interests').inputValue()).split(',')[0].trim().toLowerCase(),
    };
    await lakshmi.getByText('Please read this back to the community.').waitFor();
    await lakshmi.getByText(/they confirmed it/).click();
    const lockedWithoutConsent = await publish.isDisabled();        // the community alone is not enough
    await lakshmi.getByText(/I consent to publishing this need/).click();
    await publish.click();
    await lakshmi.waitForURL(u => u.pathname === '/coordinator');
    await lakshmi.getByText(posted.title).first().waitFor();
    check('U13 post a need (draft, warnings, read-back, consent, publish)', warnings >= 2 && lockedBeforeTick && lockedWithoutConsent,
      `warnings ${warnings}, locked before ticks ${lockedBeforeTick}, locked without consent ${lockedWithoutConsent}`);
  });

  // U16 — the published need reaches a volunteer's search
  await attempt('U16 new need shows in volunteer search', async () => {
    await meera.goto(`${WEB}/opportunities?day=${posted.day}&maxKm=5&interest=${encodeURIComponent(posted.tag)}`);
    await meera.getByText(posted.title).first().waitFor();
    check('U16 new need shows in volunteer search', true);
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

  // S6 — "Why?" opens the teaching; the Close button and a tap outside both close it
  await attempt('S6  "Why?" popup', async () => {
    const dialog = meera.getByRole('dialog');
    await meera.getByRole('button', { name: 'Why?' }).first().click();
    await dialog.getByRole('heading', { name: 'Why listen first?' }).waitFor();
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    await dialog.waitFor({ state: 'detached' });
    await meera.getByRole('button', { name: 'Why?' }).first().click();
    await dialog.waitFor();
    await meera.getByTestId('why-backdrop').click({ position: { x: 5, y: 5 } });
    await dialog.waitFor({ state: 'detached' });
    check('S6  "Why?" popup', true);
  });

  // S7 — briefing, request, what I heard, yes -> waiting
  await attempt('S7  listen flow', async () => {
    await meera.getByRole('link', { name: /Visit and listen/ }).click();
    await meera.getByText('Before you visit').waitFor();           // the teaching for this moment
    await meera.getByText('Verified teaching').first().waitFor();
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
  await attempt('S8  coordinator yes -> Commit appears', async () => {
    await lakshmi.goto(WEB + '/coordinator');
    await lakshmi.getByRole('button', { name: /Yes, welcome/ }).click();
    await lakshmi.getByText('No visits waiting.').waitFor();
    await fits(lakshmi);
    const shown = await reloadUntil(meera, meera.getByRole('link', { name: 'Commit' }));
    check('S8  coordinator yes -> Commit appears', shown, 'Commit button did not appear');
  });

  // S9 — commit for 4 weeks
  await attempt('S9  commit', async () => {
    await meera.getByRole('link', { name: 'Commit' }).click();
    const sentence = meera.getByPlaceholder('I will come every…');
    await meera.waitForFunction(() => document.querySelector('textarea')?.value.startsWith('I will come every'));
    const prefilled = await sentence.inputValue();
    await fits(meera);
    await meera.getByRole('button', { name: 'Begin 4 weeks' }).click();
    await meera.waitForURL('**/my-seva');
    await meera.getByText('Week 1').first().waitFor();
    check('S9  commit', await meera.getByText('of 4').first().isVisible() && /for 4 weeks\.$/.test(prefilled),
      `"of 4" not shown, or sentence "${prefilled}"`);
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
    await meera.getByPlaceholder(/Where we stopped/).fill('We stopped at the story about the river.');
    await meera.getByRole('button', { name: 'Tell my circle' }).click();
    await meera.getByText('cannot come', { exact: true }).first().waitFor();
    await kavya.goto(WEB + '/my-seva');
    await kavya.getByRole('button', { name: 'I will cover' }).waitFor();
    const noteSeen = await kavya.getByText('We stopped at the story about the river.').first().isVisible();
    await kavya.getByRole('button', { name: 'I will cover' }).click();
    await kavya.getByText(/cannot come in week/).waitFor({ state: 'detached' });
    await fits(kavya);
    await meera.reload();
    await meera.getByText('by Kavya').waitFor();
    check('S11 absence (with handover note) and cover', noteSeen, 'Kavya did not see the note');
  });

  // S12 — time travel to week 4 and send the invitation; the volunteer sees 3 choices
  await attempt('S12 time travel + invitation', async () => {
    await lakshmi.reload();
    const card = lakshmi.locator('li', { hasText: 'Meera Krishnan' }).filter({ has: lakshmi.getByRole('combobox') });
    await card.getByRole('combobox').selectOption({ label: 'Week 4' });
    await card.getByRole('button', { name: 'Go' }).click();
    await card.getByText('Week 4 of 4').waitFor();
    await card.getByRole('textbox').fill('The students asked if you are coming next month.');
    const lockedUntilAsked = await card.getByRole('button', { name: 'Send invitation' }).isDisabled();
    await card.getByText(/I asked the community/).click();
    await card.getByRole('button', { name: 'Send invitation' }).click();
    if (!lockedUntilAsked) throw new Error('Send invitation was enabled before the community was asked');
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

  // H1 — finishing needs a handover; the circle sees it
  const handover = 'They love reading aloud in pairs. Begin with the story they choose.';
  await attempt('H1  finish with a handover', async () => {
    await meera.goto(WEB + '/my-seva');
    await meera.getByText('Need to step away?').click();
    await meera.getByRole('button', { name: 'Finish' }).filter({ visible: true }).click();
    const finish = meera.getByRole('button', { name: 'Finish and hand over' });
    const lockedEmpty = await finish.isDisabled();
    await meera.getByPlaceholder(/The students are on chapter 3/).fill(handover);
    await finish.click();
    await meera.getByText(/Finished\. Thank you/).waitFor();
    await kavya.goto(WEB + '/my-seva');
    await kavya.getByText('Handover notes').waitFor();
    const seen = await kavya.getByText(handover).first().isVisible();
    check('H1  finish with a handover', lockedEmpty && seen, `locked when empty ${lockedEmpty}, circle sees it ${seen}`);
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

  // H2 — the need is open again, and the next volunteer reads the handover on the card
  await attempt('H2  next volunteer sees the handover', async () => {
    await meera.goto(`${WEB}/needs/${ids.needs.need2}`);
    await meera.getByText('From the volunteer before you').waitFor();
    const note = await meera.getByText(handover).isVisible();
    const canListen = await meera.getByRole('link', { name: /Visit and listen/ }).filter({ visible: true }).isVisible();
    check('H2  next volunteer sees the handover', note && canListen, `note ${note}, can visit ${canListen}`);
  });

  // U5, U6 — the seeded volunteer (week 2) opens the private diary, answers, and the entry is kept
  const arjun = await person('Arjun');
  const answer = 'I waited, and he finished the sentence himself.';
  await attempt('U5  diary: one question, private, saves', async () => {
    await arjun.goto(WEB + '/my-seva');
    await arjun.getByRole('link', { name: /Seva Diary/ }).filter({ visible: true }).click();
    await arjun.getByRole('heading', { name: 'What did someone tell you that surprised you?' }).waitFor();
    const privateNote = await arjun.getByText('Only you can see this.').isVisible();
    const weekOne = await arjun.getByText('I kept correcting them.').isVisible();
    await arjun.locator('#diary-text').fill(answer);
    await arjun.getByText('This was a hard day').click();
    await arjun.getByRole('button', { name: 'Save' }).click();
    await arjun.getByText('Saved in your diary').waitFor();
    await arjun.getByText('After a hard day').waitFor();          // the teaching for a hard day
    await arjun.reload();
    await arjun.locator('#diary-text').waitFor();
    const kept = await arjun.locator('#diary-text').inputValue();
    await fits(arjun);
    const text = await arjun.locator('main').innerText();
    const bad = text.match(/\b(hours?|points?|rank\w*|streak|score|badge)\b/i);
    check('U5  diary: one question, private, saves', privateNote && weekOne && kept === answer && !bad,
      `private note ${privateNote}, week 1 shown ${weekOne}, kept "${kept}", banned "${bad?.[0]}"`);
  });

  // U10 — Then and Now: week 1 beside the newest words
  await attempt('U10 then and now', async () => {
    await arjun.getByRole('link', { name: /Then and Now/ }).click();
    await arjun.getByTestId('then-and-now').waitFor();
    const then = await arjun.getByText('I kept correcting them.').isVisible();
    const now = await arjun.getByText(answer).isVisible();
    await fits(arjun);
    check('U10 then and now', then && now, `then ${then}, now ${now}`);
  });

  // U18 — a coordinator opening a volunteer's diary sees nothing of it
  await attempt('U18 coordinator cannot read a diary', async () => {
    await lakshmi.goto(`${WEB}/reflect/${ids.commitments.seeded}`);
    await lakshmi.getByText('This diary is private').waitFor();
    const leak = await lakshmi.getByText('I kept correcting them.').count();
    check('U18 coordinator cannot read a diary', leak === 0, 'diary text shown to the coordinator');
  });

  // U17 — a volunteer typing /coordinator/post-need is sent home
  await attempt('U17 volunteer blocked from Post a Need', async () => {
    await arjun.goto(WEB + '/coordinator/post-need');
    await arjun.waitForURL(u => u.pathname === '/');
    check('U17 volunteer blocked from Post a Need', true);
  });

  // R1 — Resource Connect: the school asks for tablets, connects with the college's offer, hands over
  await attempt('R1  resource connect', async () => {
    await lakshmi.goto(WEB + '/coordinator/resources');
    await lakshmi.getByPlaceholder('tablets').fill('tablets');
    await lakshmi.getByPlaceholder('10', { exact: true }).fill('10');
    await lakshmi.getByRole('button', { name: 'Find matches' }).click();
    await lakshmi.getByText('Sri Ramana Arts College').first().waitFor();
    await lakshmi.getByRole('button', { name: 'Connect' }).first().click();
    await lakshmi.getByText(/Connected with/).first().waitFor();
    await lakshmi.getByRole('button', { name: 'Mark handed over' }).first().click();
    await lakshmi.getByText(/Handed over on/).first().waitFor();
    await fits(lakshmi);
    check('R1  resource connect', true);
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
  console.log(`\n${count('PASS')} passed, ${count('FAIL')} failed`);
  process.exit(count('FAIL') ? 1 : 0);
})().catch(async e => { console.error(e); await browser?.close(); process.exit(1); });
