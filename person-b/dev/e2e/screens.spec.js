// Plan section 9.3 screen tests U1–U18 (U8/U9 are in voice.spec.js), on phone, tablet and laptop sizes.
import {
  expect, expectNoBannedWords, expectNoSideScroll, expectTappable, isPhone, loginAs, NEW_VOL_COMMITMENT, SEEDED, test, USERS,
} from './fixtures';

test.describe('Wisdom', () => {
  test('U1: Home shows the Wisdom card with a quote and a source', async ({ page }) => {
    await loginAs(page, USERS.seededVolunteer);
    const card = page.getByRole('region', { name: 'Seva Wisdom for Today' });
    await expect(card).toBeVisible();
    await expect(card.locator('blockquote')).toHaveText(/“.+”/);
    await expect(card).toContainText('Complete Works');
    await expectNoSideScroll(page);
  });

  test('U2: with reflect-service down, Home still loads; only the Wisdom card is missing', async ({ page }) => {
    test.info().annotations.push({ type: 'expected-http-error' });
    await page.route('**/api/wisdom/today', route => route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'This service is not connected yet' } }) }));
    await loginAs(page, USERS.seededVolunteer);
    await expect(page.getByTestId('home-loaded')).toBeVisible();
    await expect(page.getByText('Continue your Seva')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByText('Seva Wisdom for Today')).toHaveCount(0);
  });

  test('U3: Read More opens Wisdom; chips filter; every item has a source', async ({ page }) => {
    await loginAs(page, USERS.seededVolunteer);
    await page.getByRole('link', { name: /Read More/ }).click();
    await expect(page).toHaveURL(/\/wisdom$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Wisdom' })).toBeVisible();

    const items = page.locator('main li blockquote');
    await expect(items).toHaveCount(8);
    for (const source of await page.locator('main li blockquote + p span').allInnerTexts()) expect(source).toMatch(/Complete Works/);

    for (const chip of ['Service', 'Strength', 'Patience', 'Work']) {
      await page.getByRole('button', { name: chip, exact: true }).click();
      await expect(page.getByRole('button', { name: chip, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(items).not.toHaveCount(8);
      await expect(page.locator('main li').first()).toContainText(chip);
    }
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(items).toHaveCount(8);
    await expectNoSideScroll(page);
    await expectTappable(page);
    await expectNoBannedWords(page);
  });

  test('U4: "Why?" gives the right teaching for each rule; closes with the button and with tap-outside', async ({ page }) => {
    await loginAs(page, USERS.newVolunteer);
    await page.goto('/needs/demo');
    const cases = [['listen-first', 'Why listen first?'], ['no-photos', 'Why no photos?'], ['no-ranks', 'Why no leaderboard?']];
    for (const [i, [, title]] of cases.entries()) {
      await page.getByRole('button', { name: 'Why?' }).nth(i).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: title })).toBeVisible();
      await expectNoSideScroll(page);
      if (i % 2 === 0) await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
      else await page.mouse.click(8, 8);                                              // outside the sheet
      await expect(dialog).toHaveCount(0);
    }

    await page.goto('/my-seva');
    await page.getByRole('button', { name: 'Why?' }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: "Why don't we count time?" })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Seva Diary', () => {
  test('U5: My Seva → diary: one question, the privacy note, the week 1 entry', async ({ page }) => {
    await loginAs(page, USERS.seededVolunteer);
    await page.goto('/my-seva');
    await page.getByRole('link', { name: 'Open Seva Diary' }).click();
    await expect(page).toHaveURL(new RegExp(`/reflect/${SEEDED}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Week 2' })).toBeVisible();
    await expect(page.locator('form h2')).toHaveCount(1);
    await expect(page.locator('form h2')).toHaveText('What did someone tell you that surprised you?');
    await expect(page.getByText('Feel first, organize afterwards')).toBeVisible();
    await expect(page.getByText('Only you can see this.')).toBeVisible();
    await expect(page.getByRole('list').getByText('I kept correcting them.')).toBeVisible();
    await expectNoSideScroll(page);
    await expectTappable(page);
  });

  test('U6: type → Save → the entry is in the list at once, and still there after a refresh', async ({ page }) => {
    await loginAs(page, USERS.seededVolunteer);
    await page.goto(`/reflect/${SEEDED}`);
    const words = 'I waited, and he finished the sentence himself.';
    await page.getByLabel('Your answer').fill(words);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved in your diary')).toBeVisible();
    await expect(page.getByRole('list').getByText(words)).toBeVisible();

    await page.reload();
    await expect(page.getByRole('list').getByText(words)).toBeVisible();
    await expect(page.getByRole('list').locator('li')).toHaveCount(2);
    await expect(page.getByLabel('Your answer')).toHaveValue(words);
  });

  test('U7: Skip goes back and nothing is saved', async ({ page }) => {
    await loginAs(page, USERS.seededVolunteer);
    await page.goto('/my-seva');
    await page.getByRole('link', { name: 'Open Seva Diary' }).click();
    await page.getByLabel('Your answer').fill('This should not be saved');
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page).toHaveURL(/\/my-seva$/);
    await page.goto(`/reflect/${SEEDED}`);
    await expect(page.getByRole('list').locator('li')).toHaveCount(1);
    await expect(page.getByText('This should not be saved')).toHaveCount(0);
  });

  test('U10: Then and Now shows week 1 beside the newest words; no number, score or chart', async ({ page }, testInfo) => {
    await loginAs(page, USERS.seededVolunteer);
    await page.goto(`/reflect/${SEEDED}`);
    await page.getByLabel('Your answer').fill('I waited, and he finished the sentence himself.');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved in your diary')).toBeVisible();
    await page.getByRole('link', { name: /Then and Now/ }).click();

    const then = page.getByRole('heading', { name: 'Then — Week 1' });
    const now = page.getByRole('heading', { name: 'Now — Week 2' });
    await expect(then).toBeVisible();
    await expect(now).toBeVisible();
    await expect(page.getByText('I kept correcting them.')).toBeVisible();
    await expect(page.getByText(/he finished the sentence himself/)).toBeVisible();
    await expect(page.getByText('“They alone live who live for others.”')).toHaveCount(1);
    await expect(page.locator('main canvas, main progress, main meter')).toHaveCount(0);

    // stacked on a phone, side by side when there is room
    const [a, b] = [await then.boundingBox(), await now.boundingBox()];
    if (isPhone(testInfo)) expect(b.y).toBeGreaterThan(a.y + 40);
    else expect(Math.abs(b.y - a.y)).toBeLessThan(4);
    await expectNoSideScroll(page);
    await expectNoBannedWords(page);
  });

  test('U11: Then and Now for the new volunteer gives a kind message, not a blank page', async ({ page }) => {
    await loginAs(page, USERS.newVolunteer);
    await page.goto(`/reflect/${NEW_VOL_COMMITMENT}/then-and-now`);
    await expect(page.getByText(/begins with a few words/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open your diary' })).toBeVisible();
    await expectNoSideScroll(page);
  });

  test('U12: Diary and Then and Now have no hours, streak, badge, share button or photo upload', async ({ page }) => {
    await loginAs(page, USERS.seededVolunteer);
    for (const url of [`/reflect/${SEEDED}`, `/reflect/${SEEDED}/then-and-now`]) {
      await page.goto(url);
      await expect(page.locator('main h1')).toBeVisible();
      await expectNoBannedWords(page);
      await expect(page.locator('main input[type=file], main img')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /share/i })).toHaveCount(0);
      await expect(page.locator('main')).not.toContainText(/\d+ entr(y|ies)/i);
    }
  });

  test('R10 in the browser: another volunteer opening the same diary sees none of its words', async ({ page }) => {
    await loginAs(page, USERS.circleMember);
    await page.goto(`/reflect/${SEEDED}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Week 2' })).toBeVisible();
    await expect(page.getByText('I kept correcting them.')).toHaveCount(0);
    await expect(page.getByText('Your words will appear here after you save them.')).toBeVisible();
  });

  test('U18: the coordinator opening the seeded diary URL sees no entries', async ({ page }) => {
    await loginAs(page, USERS.coordinator);
    await page.goto(`/reflect/${SEEDED}`);
    await expect(page.getByRole('heading', { name: 'This diary is private' })).toBeVisible();
    await expect(page.getByText('I kept correcting them.')).toHaveCount(0);
    await page.goto(`/reflect/${SEEDED}/then-and-now`);
    await expect(page.getByText(/begins with a few words/)).toBeVisible();
    await expect(page.getByText('I kept correcting them.')).toHaveCount(0);
  });
});

test.describe('Post a Need', () => {
  const SENTENCE = '12 students of class 6 to 8 want help reading English aloud, Saturday mornings at the government school in Kanchipuram';

  test('U13 → U16: type → Make draft → edit → tick read-back → Publish → the need is open', async ({ page }) => {
    await loginAs(page, USERS.coordinator);
    await page.getByRole('link', { name: 'Post a Need' }).click();
    await expect(page).toHaveURL(/\/coordinator\/post-need$/);
    await expectNoSideScroll(page);
    await expectTappable(page);

    await page.getByText('English', { exact: true }).click();
    await page.getByLabel('What does the community need?').fill(SENTENCE);
    const started = Date.now();
    await page.getByRole('button', { name: 'Make draft' }).click();
    await expect(page.getByRole('heading', { name: 'Check the card' })).toBeVisible({ timeout: 8000 });     // U13
    expect(Date.now() - started).toBeLessThan(8000);

    for (const label of ['Title', 'What we want', 'How to serve us well', 'What you will learn', 'Place', 'Group size', 'Interests', 'Day', 'From', 'To', 'Weeks'])
      await expect(page.getByLabel(label, { exact: true })).toBeEditable();
    await page.getByLabel('Title', { exact: true }).fill('Reading Aloud Together');

    const publish = page.getByRole('button', { name: 'Publish' });
    await expect(publish).toBeDisabled();                                                                  // U15
    await page.getByLabel(/I read this back to the community and they agreed/).check();
    await expect(publish).toBeEnabled();
    await expectNoSideScroll(page);
    await expectTappable(page);
    await expectNoBannedWords(page);
    await publish.click();

    await expect(page).toHaveURL(/\/coordinator$/);                                                         // U16
    await expect(page.getByTestId('open-needs')).toContainText('Reading Aloud Together');

    // the volunteer side finds it too (the mock gateway stands in for A's endpoint 4)
    await loginAs(page, USERS.newVolunteer);
    const needs = await page.evaluate(async () => {
      const { token } = JSON.parse(localStorage.getItem('seva-auth')).state;
      const res = await fetch('http://localhost:8090/api/needs', { headers: { Authorization: `Bearer ${token}` } });
      return (await res.json()).data;
    });
    expect(needs.map(n => n.title)).toContain('Reading Aloud Together');
    expect(needs[0].consent.readBack).toBe(true);
  });

  test('U14: "poor boy Ravi, income 5000" → yellow privacy warnings above the form', async ({ page }) => {
    await loginAs(page, USERS.coordinator);
    await page.goto('/coordinator/post-need');
    await page.getByText('English', { exact: true }).click();
    await page.getByLabel('What does the community need?').fill('poor boy Ravi, income 5000');
    await page.getByRole('button', { name: 'Make draft' }).click();
    const warnings = page.getByTestId('privacy-warnings');
    await expect(warnings).toBeVisible();
    await expect(warnings).toContainText('Mentions money or income');
    await expect(warnings).toContainText('Uses a word we avoid');
    const [w, title] = [await warnings.boundingBox(), await page.getByLabel('Title', { exact: true }).boundingBox()];
    expect(w.y).toBeLessThan(title.y);
    const bg = await warnings.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(254, 246, 216)');                                                                  // --color-warn
  });

  test('Tamil words go through the same path (no keys → fallback draft)', async ({ page }) => {
    await loginAs(page, USERS.coordinator);
    await page.goto('/coordinator/post-need');
    await expect(page.getByRole('radio', { name: /தமிழ்/ })).toBeChecked();
    await page.getByLabel('What does the community need?').fill('காஞ்சிபுரம் அரசுப் பள்ளியில் 12 மாணவர்களுக்கு ஆங்கிலம் படிக்க உதவி வேண்டும்');
    await page.getByRole('button', { name: 'Make draft' }).click();
    await expect(page.getByText(/this is a sample card/)).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('English Reading Support');
  });

  test('U17: a volunteer typing /coordinator/post-need is sent away', async ({ page }) => {
    await loginAs(page, USERS.seededVolunteer);
    await page.goto('/coordinator/post-need');
    await expect(page).toHaveURL(/localhost:5180\/$/);
    await expect(page.getByRole('heading', { name: 'Post a Need' })).toHaveCount(0);
  });
});

test.describe('fits every screen', () => {
  const pages = [
    ['Wisdom', '/wisdom', USERS.seededVolunteer],
    ['Diary', `/reflect/${SEEDED}`, USERS.seededVolunteer],
    ['Then and Now', `/reflect/${SEEDED}/then-and-now`, USERS.seededVolunteer],
    ['Post a Need', '/coordinator/post-need', USERS.coordinator],
  ];

  for (const [name, url, user] of pages) {
    test(`${name}: no sideways scroll, tappable controls, title visible`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto(url);
      await expect(page.locator('main h1')).toBeVisible();
      await expectNoSideScroll(page);
      await expectTappable(page);
      const h1 = await page.locator('main h1').boundingBox();
      expect(h1.x).toBeGreaterThanOrEqual(12);                                       // a side gutter, not touching the edge
    });

    test(`${name}: still fits inside a 430 px app shell (A's AppShell) on this screen`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto(`${url}?shell=narrow`);
      await expect(page.locator('main h1')).toBeVisible();
      await expectNoSideScroll(page);
      const main = await page.locator('main').boundingBox();
      expect(main.width).toBeLessThanOrEqual(431);
      const overflow = await page.locator('main').evaluate(el => [...el.querySelectorAll('*')]
        .filter(n => n.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).length);
      expect(overflow).toBe(0);
    });
  }
});
