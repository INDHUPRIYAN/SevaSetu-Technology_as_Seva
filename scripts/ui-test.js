// scripts/ui-test.js — screen tests S1–S15 from PERSON_A_LEAD.md section 8.2, in real Chrome
// at 390 px (phone layout), or at 1440 px with --desktop (sidebar layout).
//   npm run test:ui                                   local: reseeds, then tests http://localhost:5174
//   npm run test:ui:desktop                           the same at 1440 px
//   WEB=https://your-site.vercel.app GW=https://your-gateway node scripts/ui-test.js   deployed (seed Atlas first)
// Needs the backend and the web app running, and Google Chrome installed (CHROME_PATH to override).
// Every screen is also checked for sideways scrolling and console errors.
const { chromium } = require('playwright-core');
const ids = require('../seed/ids');

const WEB = (process.env.WEB || 'http://localhost:5174').replace(/\/$/, '');
const GW = (process.env.GW || 'http://localhost:8080').replace(/\/$/, '');     // the gateway, for one direct API read
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
    await meera.getByRole('link', { name: 'Find a Need' }).waitFor();
    const ms = Date.now() - t0;
    await fits(meera);
    const tabs = [['Needs', '/opportunities'], ['My Seva', '/my-seva'], ['Wisdom', '/wisdom'], ['Profile', '/profile'], ['Home', '/']];
    for (const [label, path] of tabs) {
      await meera.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label }).click();
      await meera.waitForURL(u => u.pathname === path);
      await fits(meera);
    }
    check('S2  home loads, 5 tabs work', ms < 3000, `home took ${ms} ms`);
  });

  // U1, U3 — "Seva Wisdom for Today" on Home with its source; Read More opens Wisdom; chips filter
  await attempt('U1  wisdom card + Wisdom page', async () => {
    await meera.goto(WEB + '/');
    await meera.waitForLoadState('networkidle');
    // ask the API directly (reading the page's own response body is flaky in Chrome)
    const today = await meera.evaluate(async gw => {
      const token = JSON.parse(localStorage.getItem('sevasetu-auth') || '{}')?.state?.token;
      const r = await fetch(`${gw}/api/wisdom/today`, { headers: { Authorization: `Bearer ${token}` } });
      return (await r.json()).data;
    }, GW);
    if (today === null) {
      // quotes appear only once verified: true in seed/wisdom.json; until then the card stays hidden
      console.log('SKIP  U1  wisdom card + Wisdom page  -> no quote is verified yet');
      return;
    }
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
  await attempt('U13 post a need (VoiceBridge, warnings, read-back, publish)', async () => {
    await lakshmi.goto(WEB + '/coordinator/post-need');
    // VoiceBridge in Tamil first: a vague sentence gets ONE question, in Tamil; the card builds live
    await lakshmi.getByRole('radio', { name: /தமிழ்/ }).check({ force: true });
    const words = lakshmi.locator('#need-words');
    await words.fill('பள்ளி குழந்தைகளுக்கு ஆங்கிலம் படிக்க உதவி வேண்டும்');
    await lakshmi.getByRole('button', { name: 'Send' }).click();
    const prompt = lakshmi.getByTestId('voicebridge-prompt');
    await prompt.getByText(/[஀-௿]/).waitFor({ timeout: 20000 });
    const tamilQuestion = /[஀-௿]/.test(await prompt.innerText()) && /\?/.test(await prompt.innerText());
    const oneQuestion = await lakshmi.getByText(/Question 1 of 3/).isVisible();
    const liveCard = await lakshmi.getByTestId('live-card').locator('[data-empty="true"]').count();
    await lakshmi.reload();                                                          // start the English card afresh
    await lakshmi.getByRole('radio', { name: 'English' }).check({ force: true });     // the draft language, not the UI toggle
    await words.fill('Ravi, a poor boy, his father\'s income is Rs 5000, wants help with English on Saturday.');
    await lakshmi.getByRole('button', { name: 'Send' }).click();
    await lakshmi.getByRole('button', { name: 'Check the card' }).click();
    await lakshmi.getByTestId('dignity-check').locator('mark').first().waitFor({ timeout: 20000 });
    const warnings = await lakshmi.getByTestId('dignity-check').locator('mark').count();
    await lakshmi.getByTestId('dignity-check').getByText('Suggested', { exact: true }).first().waitFor();
    await lakshmi.getByTestId('dignity-check').getByRole('button', { name: 'Use this' }).first().click();
    const rewritten = await lakshmi.locator('#need-original').inputValue();
    if (/Ravi|poor|5000/.test(rewritten)) throw new Error(`the rewrite was not used: ${rewritten}`);
    await lakshmi.reload();
    await lakshmi.getByRole('radio', { name: 'English' }).check({ force: true });
    // one complete sentence: no question, straight to the card
    await words.fill('12 students of class 6 to 8 want help reading English aloud at the Government School in Kanchipuram, every Saturday 10:30 am to 12, for 4 weeks. Volunteers should let them choose the story. A volunteer will learn to wait.');
    await lakshmi.getByRole('button', { name: 'Send' }).click();
    await lakshmi.getByText('Nothing more is needed').waitFor({ timeout: 20000 });
    const noQuestion = (await lakshmi.getByTestId('live-card').locator('[data-empty="true"]').count()) === 0;
    await lakshmi.getByRole('button', { name: 'Check the card' }).click();
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
    // Read It Aloud sits on the read-back step; with no speech provider here, the browser's own voice is offered
    const readAloud = await lakshmi.getByTestId('read-aloud').isVisible();
    await lakshmi.getByText(/they confirmed it/).click();
    const lockedWithoutConsent = await publish.isDisabled();        // the community alone is not enough
    await lakshmi.getByText(/I consent to publishing this need/).click();
    await publish.click();
    await lakshmi.waitForURL(u => u.pathname === '/coordinator');
    await lakshmi.getByText(posted.title).first().waitFor();
    check('U13 post a need (VoiceBridge, warnings, read-back, consent, publish)',
      tamilQuestion && oneQuestion && liveCard > 0 && noQuestion && warnings >= 2 && lockedBeforeTick && lockedWithoutConsent && readAloud,
      `tamil question ${tamilQuestion}, one question ${oneQuestion}, gaps marked ${liveCard}, complete sentence had no gaps ${noQuestion}, read aloud ${readAloud}, warnings ${warnings}, locked before ticks ${lockedBeforeTick}, locked without consent ${lockedWithoutConsent}`);
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
    await meera.getByRole('heading', { name: /Listening Guide/ }).waitFor();
    await meera.locator('#listening-guide ~ ol li').first().waitFor({ timeout: 20000 });   // the model may take a moment
    if (await meera.locator('#listening-guide ~ ol li').count() !== 3) throw new Error('the Listening Guide does not show 3 questions');
    await meera.getByText('Interpretation').first().waitFor();       // our words; the quote shows once verified
    await meera.getByRole('button', { name: 'I understand' }).click();
    await meera.getByRole('button', { name: 'Request a visit' }).click();
    await meera.getByPlaceholder(/I thought they wanted/).fill('They wanted to speak first, and only then read.');
    await meera.getByRole('button', { name: 'Save what I heard' }).click();
    // One Visit ramp: the volunteer is asked nothing after the visit
    await meera.getByText('The next word is theirs').waitFor();
    if (await meera.getByRole('button', { name: /^(Yes|Commit)$/ }).count()) throw new Error('the volunteer was asked to decide before the community');
    await meera.getByText('Waiting for the community’s answer').waitFor();
    await fits(meera);
    check('S7  listen flow', true);
  });

  // S8 — the coordinator says yes in another browser; the volunteer sees Commit
  await attempt('S8  coordinator yes -> Commit appears', async () => {
    await lakshmi.goto(WEB + '/coordinator');
    await lakshmi.getByRole('button', { name: /Invite them back/ }).click();
    await lakshmi.getByText('No visits waiting.').waitFor();
    // Updated after listening: the suggested line from what Meera heard, approved onto the card
    const update = lakshmi.getByTestId('listening-update').filter({ hasText: 'They wanted to speak first' });
    await update.getByRole('button', { name: /Add to the card/ }).click();
    await update.waitFor({ state: 'detached' });
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
    const locked = await meera.getByRole('button', { name: 'Begin 4 weeks' }).isDisabled();   // the Sankalpa comes first
    await meera.getByText('not what you will deliver').waitFor();                     // the helper line
    await meera.getByPlaceholder('I hope to learn…').fill('To wait for someone else to find their words.');
    await fits(meera);
    await meera.getByRole('button', { name: 'Begin 4 weeks' }).click();
    await meera.waitForURL('**/my-seva');
    await meera.getByText('Week 1').first().waitFor();
    check('S9  commit (with Sankalpa)', locked && await meera.getByText('of 4').first().isVisible() && /for 4 weeks\.$/.test(prefilled),
      `locked before Sankalpa ${locked}, or "of 4" not shown, or sentence "${prefilled}"`);
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
    await meera.getByRole('button', { name: 'I cannot come this week' }).click();          // one tap
    await meera.getByText('cannot come', { exact: true }).first().waitFor();
    await meera.getByPlaceholder(/Where we stopped/).fill('We stopped at the story about the river.');
    await meera.getByRole('button', { name: 'Save note' }).click();
    await meera.getByRole('button', { name: 'Save note' }).waitFor({ state: 'visible' });
    await meera.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Save note') && b.disabled));
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
    await card.getByText('The children were never left waiting.').waitFor();     // week 2 was covered, so no gap
    // Community Check-in is due at week 4: three answers given in person
    const checkIn = card.getByTestId('check-in');
    await checkIn.getByLabel('Is this helping?').fill('Yes. They read aloud more now.');
    await checkIn.getByLabel('Should anything change?').fill('Start ten minutes later.');
    await checkIn.getByLabel('What can the group now do on their own?').fill('Choose their own books.');
    await checkIn.getByRole('button', { name: /Save the check-in/ }).click();
    await checkIn.waitFor({ state: 'detached' });
    await card.getByText('Check-in, week 4').waitFor();
    await card.getByRole('textbox', { name: 'Invitation to continue' }).fill('The students asked if you are coming next month.');
    const lockedUntilAsked = await card.getByRole('button', { name: 'Send invitation' }).isDisabled();
    await card.getByText(/I asked the community/).click();
    await card.getByRole('button', { name: 'Send invitation' }).click();
    if (!lockedUntilAsked) throw new Error('Send invitation was enabled before the community was asked');
    await card.getByText(/Invitation sent/).waitFor();
    await fits(lakshmi);
    await meera.reload();
    await meera.getByText('An invitation from the community').filter({ visible: true }).waitFor();
    const choices = await Promise.all([
      meera.getByRole('button', { name: 'Continue', exact: true }).isVisible(),
      meera.getByRole('button', { name: 'Pause' }).isVisible(),
      meera.getByRole('link', { name: 'Finish' }).isVisible(),            // finishing is its own full screen
    ]);
    await fits(meera);
    check('S12 time travel + invitation', choices.every(Boolean), `choices ${choices}`);
  });

  // S13 — Continue -> Week 4 of 8
  await attempt('S13 continue', async () => {
    await meera.getByRole('button', { name: 'Continue', exact: true }).click();
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
    await meera.getByRole('link', { name: 'Finish' }).filter({ visible: true }).click();
    // the "finished" moment: "What did they give you?" comes first, and only then the handover
    await meera.waitForURL('**/moments/finished/**');
    await meera.getByText('What did they give you?').waitFor();
    if (await meera.getByPlaceholder(/They are on chapter 3/).count()) throw new Error('the handover was asked before "What did they give you?"');
    await meera.getByPlaceholder('They gave me…').fill('Their patience while I found the words.');
    await fits(meera);
    await meera.getByRole('button', { name: 'Next' }).click();
    await meera.getByText('What did you give?').waitFor();
    const finish = meera.getByRole('button', { name: 'Finish and hand over' });
    const lockedEmpty = await finish.isDisabled();
    await meera.getByPlaceholder(/They are on chapter 3/).fill(handover);
    await meera.getByPlaceholder(/Reading aloud in pairs/).fill('Let them choose the story.');
    await meera.getByPlaceholder(/Arrive a few minutes early/).fill('The room opens at 10.');
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

  // M1 — the "declined" moment: Rahul visits need 3, the community says not now; a calm screen, one action
  await attempt('M1  declined moment', async () => {
    await meera.goto(`${WEB}/needs/${ids.needs.need3}/listen`);
    await meera.getByRole('button', { name: 'I understand' }).click();
    await meera.getByRole('button', { name: 'Request a visit' }).click();
    await meera.getByPlaceholder(/I thought they wanted/).fill('They want to choose the songs themselves.');
    await meera.getByRole('button', { name: 'Save what I heard' }).click();
    await meera.getByText('The next word is theirs').waitFor();
    await lakshmi.goto(WEB + '/coordinator');
    await lakshmi.getByRole('button', { name: 'Not now' }).click();
    await lakshmi.getByText('No visits waiting.').waitFor();
    await meera.goto(`${WEB}/needs/${ids.needs.need3}/listen`);
    await meera.waitForURL('**/moments/declined');
    await meera.getByRole('heading', { name: 'Not this time' }).waitFor();
    const text = await meera.locator('main').innerText();
    const nav = await meera.getByRole('navigation', { name: 'Main' }).count();
    await fits(meera);
    await meera.getByRole('link', { name: 'See the next need' }).click();
    await meera.waitForURL('**/opportunities');
    check('M1  declined moment', !/sorry/i.test(text) && nav === 0 && /theirs to give/.test(text), `sorry ${/sorry/i.test(text)}, nav ${nav}`);
  });

  // H2 — the need is open again, and the next volunteer reads the handover on the card
  await attempt('H2  next volunteer sees the handover', async () => {
    await meera.goto(`${WEB}/needs/${ids.needs.need2}`);
    await meera.getByText('From the volunteer before you').waitFor();
    const note = await meera.getByText(handover).isVisible();
    const canListen = await meera.getByRole('link', { name: /Visit and listen/ }).filter({ visible: true }).isVisible();
    check('H2  next volunteer sees the handover', note && canListen, `note ${note}, can visit ${canListen}`);
  });

  // V1 — the community's voice back: Lakshmi relays one line from the group on Meera's finished seva, through the
  // Dignity Check (a name is flagged; she uses the rewrite), and Meera sees it on My Seva and Then and Now
  const groupSaid = 'They said the Saturday mornings are theirs now.';
  await attempt('V1  community words at finish', async () => {
    await lakshmi.goto(WEB + '/coordinator');
    const card = lakshmi.locator('li', { hasText: 'Meera Krishnan' }).filter({ hasText: 'finished' }).first();
    await card.getByRole('button', { name: 'Add what the group wanted to say' }).click();
    const box = card.getByRole('textbox', { name: 'What the group wanted to say' });
    await box.fill('Ravi said the poor children miss you.');
    await card.getByTestId('dignity-check').getByText(/poor/).first().waitFor();          // flagged
    const relay = card.getByRole('button', { name: /^Relay to/ });
    const lockedWhileFlagged = await relay.isDisabled();
    await box.fill(groupSaid);
    await card.getByText('Nothing to change').waitFor();
    await card.getByText(/I checked these words/).click();
    await relay.click();
    await card.getByTestId('community-words').getByText(groupSaid).waitFor();
    // this browser is Rahul since S15: log out, log in as Meera
    await meera.goto(WEB + '/profile');
    await meera.getByRole('button', { name: 'Log out' }).click();
    await meera.waitForURL('**/login');
    await meera.getByRole('button', { name: /Meera/ }).click();
    await meera.waitForURL(u => !u.pathname.startsWith('/login'));
    await meera.goto(WEB + '/my-seva');
    await meera.getByTestId('community-words').first().getByText(groupSaid).waitFor();
    await fits(meera);
    await meera.getByRole('link', { name: /Seva Diary/ }).filter({ visible: true }).click();
    await meera.waitForURL('**/reflect/**');
    const diaryUrl = new URL(meera.url());
    await meera.goto(`${WEB}${diaryUrl.pathname}/then-and-now`);
    await meera.getByTestId('community-words').getByText(groupSaid).waitFor();
    const onThenAndNow = true;
    await fits(meera);
    check('V1  community words at finish', lockedWhileFlagged && onThenAndNow, `locked while flagged ${lockedWhileFlagged}, on Then and Now ${onThenAndNow}`);
  });

  // U5, U6 — the seeded volunteer (week 2) opens the private diary, answers, and the entry is kept
  const arjun = await person('Arjun');
  const answer = 'I waited, and he finished the sentence himself.';
  // Silent Seva: "I have arrived" → a calm full screen with no nav → "Session over" marks the week served and opens the diary
  await attempt('SS  silent seva', async () => {
    await arjun.goto(WEB + '/my-seva');
    await arjun.getByRole('link', { name: /I have arrived/ }).filter({ visible: true }).click();
    await arjun.getByText('Put the phone away.').waitFor();
    const noNav = await arjun.getByRole('navigation').count() === 0;
    await fits(arjun);
    await arjun.getByRole('button', { name: 'Session over' }).click();
    await arjun.waitForURL(`**/reflect/${ids.commitments.seeded}`);
    await arjun.goto(WEB + '/my-seva');
    await arjun.getByText('This week is served. Thank you.').waitFor();
    check('SS  silent seva', noNav, 'the nav showed on the silent screen');
  });

  await attempt('U5  diary: one question, private, saves', async () => {
    await arjun.goto(WEB + '/my-seva');
    await arjun.getByRole('link', { name: /Seva Diary/ }).filter({ visible: true }).click();
    await arjun.getByRole('heading', { name: 'What did someone tell you that surprised you?' }).waitFor();
    const privateNote = await arjun.getByText('Only you can see this.').isVisible();
    const weekOne = await arjun.getByText('I kept correcting them.').isVisible();
    await arjun.locator('#diary-text').fill(answer);
    await arjun.getByText('This was a hard day').click();
    await arjun.getByText('What was in your hands today, and what was not?').first().waitFor();   // Hard Day mode
    const ownWords = await arjun.getByText('You wrote, on an earlier week:').isVisible();
    if (!ownWords) throw new Error('Hard Day mode did not show her earlier words');
    await arjun.getByRole('button', { name: 'Save' }).click();
    await arjun.getByText('Saved in your diary').waitFor();
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
    await arjun.getByText('Your Sankalpa').waitFor();
    const then = await arjun.getByText('I kept correcting them.').isVisible();
    const now = await arjun.getByText(answer).isVisible();
    await fits(arjun);
    check('U10 then and now', then && now, `then ${then}, now ${now}`);
  });

  // U18 — a coordinator opening a volunteer's diary sees nothing of it
  // P1 — Profile: "My Seva so far" shows Arjun's first words and his Sankalpa, with no count or total
  await attempt('P1  my seva so far on Profile', async () => {
    await arjun.goto(WEB + '/profile');
    const card = arjun.getByTestId('my-seva-so-far');
    await card.getByText('I kept correcting them.').waitFor();
    await card.getByText(/find their words/).waitFor();
    const text = await card.innerText();
    await fits(arjun);
    check('P1  my seva so far on Profile', !/\d+ (entries|weeks|sevas|commitments)/i.test(text), 'a count or total is shown');
  });

  // L1 — Tamil on the coordinator screens only: the chrome translates, what people wrote does not; and it stays
  // across pages until switched back
  await attempt('L1  tamil coordinator screens', async () => {
    await lakshmi.goto(WEB + '/coordinator');
    await lakshmi.getByRole('button', { name: 'தமிழ்' }).first().click();
    await lakshmi.getByRole('heading', { name: /^வணக்கம்/ }).waitFor();
    const needTitleAsWritten = await lakshmi.getByText('English Reading Support').first().isVisible();
    await lakshmi.getByRole('link', { name: /ஒரு தேவையைப் பதிவிடுங்கள்/ }).click();
    await lakshmi.waitForURL('**/coordinator/post-need');
    await lakshmi.getByRole('heading', { name: 'ஒரு தேவையைப் பதிவிடுங்கள்' }).waitFor();
    await fits(lakshmi);
    await lakshmi.getByRole('button', { name: 'English' }).first().click();
    await lakshmi.getByRole('heading', { name: 'Post a Need' }).waitFor();
    await lakshmi.goto(WEB + '/coordinator');
    await lakshmi.getByRole('heading', { name: /^Vanakkam/ }).waitFor();
    check('L1  tamil coordinator screens', needTitleAsWritten, 'the need title was translated or hidden');
  });

  // W1 — demo step 12: on Wisdom, describe a hard day; the Teaching Finder answers with a verified teaching (its
  // stored text and source) or says plainly that no verified teaching was found. Never any text of its own.
  await attempt('W1  teaching finder on Wisdom', async () => {
    await arjun.goto(WEB + '/wisdom');
    await arjun.waitForLoadState('networkidle');
    if (!(await arjun.getByRole('heading', { name: 'Teaching Finder' }).count())) {
      // the finder shows only once a quote is verified in seed/wisdom.json; until then there is nothing to find
      console.log('SKIP  W1  teaching finder on Wisdom  -> no quote is verified yet, so the finder is not shown');
      return;
    }
    await arjun.getByLabel(/Describe what happened/).fill('I had a hard day. I had to wait a long time, and I got impatient with them.');
    await arjun.getByRole('button', { name: /Find a teaching/ }).click();
    const found = arjun.getByTestId('found-teaching');
    const none = arjun.getByText(/No verified teaching was found/);
    await found.or(none).first().waitFor({ timeout: 20000 });
    const shown = await found.count();
    const ok = shown ? /Complete Works/.test(await found.innerText()) : await none.isVisible();
    await fits(arjun);
    check('W1  teaching finder on Wisdom', ok, shown ? 'a teaching without its source' : 'neither a teaching nor the plain "none found" line');
  });

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

  // R1 — Resource Connect: the school's "we lack 10 tablets" meets the college's "we have", hands over, in use
  await attempt('R1  resource connect', async () => {
    await lakshmi.goto(WEB + '/coordinator/resources');
    await lakshmi.getByText('Sri Ramana Arts College').first().waitFor();
    await lakshmi.getByRole('button', { name: 'Connect' }).first().click();
    await lakshmi.getByText(/Connected with/).first().waitFor();
    await lakshmi.getByRole('button', { name: 'Mark handed over' }).first().click();
    await lakshmi.getByText('Is it in use?').first().waitFor();
    await lakshmi.getByRole('button', { name: 'Yes', exact: true }).first().click();
    await lakshmi.getByText(/In use — thank you/).first().waitFor();
    await fits(lakshmi);
    check('R1  resource connect', true);
  });

  // a volunteer typing /coordinator is sent home
  await attempt('X1  volunteer blocked from /coordinator', async () => {
    await meera.goto(WEB + '/coordinator');
    await meera.waitForURL(u => u.pathname === '/');
    check('X1  volunteer blocked from /coordinator', true);
  });

  // M2 — the "closed" moment: the coordinator ends Arjun's need (English Reading Support). Arjun lands on
  // the calm screen with nothing to choose, then My Seva shows the seva as complete. Last, because it ends his seva.
  await attempt('M2  closed moment', async () => {
    await lakshmi.goto(WEB + '/coordinator');
    // the Post a Need step earlier posted a card with the same title; the seeded one is the row marked filled
    const row = lakshmi.getByTestId('need-row').filter({ hasText: 'English Reading Support' }).filter({ hasText: 'filled' });
    await row.getByRole('button', { name: 'This need has ended' }).click();
    await row.getByPlaceholder(/Why it ended/).fill('The school has moved to a new building.');
    await row.getByRole('button', { name: 'Close this need' }).click();
    await lakshmi.getByTestId('need-row').filter({ hasText: 'English Reading Support' }).getByText('closed').waitFor();
    const arjun = await person('Arjun');
    await arjun.goto(WEB + '/my-seva');
    await arjun.waitForURL('**/moments/closed/**');
    await arjun.getByRole('heading', { name: 'This seva is complete' }).waitFor();
    const choices = await arjun.getByRole('button', { name: /Continue|Pause|Finish/ }).count();
    await fits(arjun);
    await arjun.getByRole('link', { name: 'Back to My Seva' }).click();
    await arjun.waitForURL('**/my-seva');
    await arjun.getByText(/This seva is complete/).waitFor();
    await arjun.context().close();
    check('M2  closed moment', choices === 0, `choices offered ${choices}`);
  });


  check('D2  no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  check(`--  every screen fits ${VIEWPORT.width} px`, overflowing.length === 0, `too wide: ${[...new Set(overflowing)].join(', ')}`);

  await browser.close();
  const count = st => results.filter(x => x === st).length;
  console.log(`\n${count('PASS')} passed, ${count('FAIL')} failed`);
  process.exit(count('FAIL') ? 1 : 0);
})().catch(async e => { console.error(e); await browser?.close(); process.exit(1); });
