// Shared browser-test helpers: a fresh seeded database per test, login, and the checks every screen must pass.
import { test as base, expect } from '@playwright/test';

export const GATEWAY = 'http://localhost:8090';
export const SEEDED = '650000000000000000000041';
export const NEW_VOL_COMMITMENT = '650000000000000000000042';
export const USERS = {
  newVolunteer: 'Meera Sundar',
  seededVolunteer: 'Kavya Raman',
  circleMember: 'Arjun Mohan',
  coordinator: 'Lakshmi Narayanan',
};

// Words that must not appear on any of B's screens (plan section 9.5). The privacy warnings are
// left out on purpose: they name the word the coordinator should remove.
export const BANNED = /\b(beneficiar\w*|poor|needy|donate|hours|rank|ranks|points|score|streak|badge)\b/i;

export const test = base.extend({
  // every test starts from the seed, with no published needs
  page: async ({ page, request }, use, testInfo) => {
    const reset = await request.post(`${GATEWAY}/__dev/reset`);
    expect(reset.ok()).toBeTruthy();

    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/fonts\.(googleapis|gstatic)/.test(text)) return;                       // offline fonts are not our bug
      if (testInfo.annotations.some(a => a.type === 'expected-http-error') && /Failed to load resource/.test(text)) return;
      errors.push(`console: ${text}`);
    });
    await use(page);
    expect(errors, 'no red errors in the browser console').toEqual([]);
  },
});

export { expect };

export async function loginAs(page, name) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

// The page fits the screen: nothing sticks out sideways
export async function expectNoSideScroll(page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'page is wider than the screen').toBeLessThanOrEqual(clientWidth + 1);
}

// Every button and link in the page body is big enough to tap (44 px) and on screen horizontally
export async function expectTappable(page) {
  const problems = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('main button, main a[href], main select, main input[type=checkbox]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const tapHeight = el.type === 'checkbox' ? el.closest('label')?.getBoundingClientRect().height || r.height : r.height;
      if (tapHeight < 43.5 && !el.closest('[data-allow-small]')) out.push(`${el.textContent.trim() || el.ariaLabel || el.tagName}: ${Math.round(tapHeight)}px tall`);
      if (r.left < -1 || r.right > window.innerWidth + 1) out.push(`${el.textContent.trim()}: off screen`);
    }
    return out;
  });
  expect(problems).toEqual([]);
}

export async function expectNoBannedWords(page) {
  const text = await page.evaluate(() => {
    const main = document.querySelector('main').cloneNode(true);
    main.querySelectorAll('[data-testid=privacy-warnings]').forEach(n => n.remove());
    return main.innerText;
  });
  expect(text).not.toMatch(BANNED);
}

export const isPhone = testInfo => testInfo.project.name.includes('phone');
