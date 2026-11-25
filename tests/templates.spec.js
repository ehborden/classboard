const { test, expect } = require('@playwright/test');
const { openApp, stored, settle, board, widget } = require('./helpers');

test('save a screen as a template, then start a new screen from it with its contents', async ({ page }) => {
  await openApp(page, board([
    widget('agenda', { title: 'Warm up', items: [{ id: 'a', txt: 'Warm up', done: false }] }),
    widget('timer', { dur: 420 }, [0.5, 0.1, 0.3, 0.6]),
  ]));
  // With no templates yet, + still offers the starting points and a way to save one.
  await page.click('.tab.add');
  await expect(page.locator('.pop')).toContainText('None yet');
  await page.click('.pop .opt >> text=Default layout');
  await expect(page.locator('.widget .wlabel')).toHaveText(['Agenda', 'Text box', 'Clock', 'Timer']);
  await page.click('.tab >> text=Screen 1');

  await page.click('#bGear'); await page.click('.pop >> text=Screen settings');
  await page.click('.pop >> text=Save as template');
  await page.fill('.pop input', 'Warm up');
  await page.click('.pop >> text=Save template');
  expect((await stored(page)).templates.map(t => t.name)).toEqual(['Warm up']);

  await page.click('.tab.add');
  await expect(page.locator('.pop')).toContainText('Your templates');
  await page.locator('.pop .opt >> text=Warm up').first().click();
  await expect(page.locator('.tab.on')).toHaveText('Warm up');
  await expect(page.locator('.ag-txt')).toHaveValue('Warm up');
  await expect(page.locator('.timer .dialbox svg text').last()).toHaveText('7:00');

  const s = await stored(page);
  const ids = s.screens.flatMap(sc => sc.widgets.map(w => w.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('blank screens and managing templates', async ({ page }) => {
  await openApp(page, board([widget('clock', { h24: false, sec: false, date: true })], {
    templates: [{ id: 't1', name: 'Test day', bg: 'sage', widgets: [widget('timer', { dur: 600 })] }],
  }));
  await page.click('.tab.add');
  await page.click('.pop .opt >> text=Blank');
  await expect(page.locator('.empty')).toContainText('This screen is empty.');
  await page.click('#bGear'); await page.click('.pop >> text=Templates');
  await page.fill('.pop input', 'Quiz day'); await settle(page);
  await page.click('.pop >> text=Delete'); await page.click('.pop >> text=Sure?');
  expect((await stored(page)).templates).toEqual([]);
});

test('duplicating a screen keeps seating chart assignments', async ({ page }) => {
  await openApp(page, board([widget('seats', {
    classId: 'c1', initials: false, seats: { c1: { ch1: 'Maya R' } },
    items: [{ id: 'ch1', kind: 'chair', x: 0.4, y: 0.4, w: 0.1, h: 0.1, label: '' }],
  }, [0.02, 0.03, 0.96, 0.94])]));
  await page.click('#bGear'); await page.click('.pop >> text=Screen settings');
  await page.click('.pop >> text=Duplicate screen');
  await expect(page.locator('.tab.on')).toHaveText('Screen 1 copy');
  await expect(page.locator('.seat-chair .seat-name')).toHaveText('Maya R');
});

test('starter screens: each one makes a working screen, and there is no separate background setting', async ({ page }) => {
  await openApp(page);
  await page.click('.tab.add');
  await expect(page.locator('.pop')).toContainText('Starter screens');
  await expect(page.locator('.starter-list')).toBeHidden();
  await page.click('.pop-toggle');
  await expect(page.locator('.pop-toggle')).toHaveAttribute('aria-expanded', 'true');
  const names = ['Slides', 'Warm up', 'Seats and warm up', 'Work time', 'Test or quiz day', 'Groups'];
  for (const n of names) await expect(page.locator('.pop .opt', { hasText: n }).first()).toBeVisible();
  await page.click('.pop .opt >> text=Test or quiz day');
  await expect(page.locator('.tab.on')).toHaveText('Test or quiz day');
  expect((await page.locator('.widget .wlabel').allTextContents()).sort()).toEqual(['Clock', 'Task steps', 'Text box', 'Timer']);
  await expect(page.locator('.st-txt').first()).toHaveValue('Name on every page');
  // Starting a second screen from the same starter gives every widget its own id.
  await page.click('.tab.add'); await page.click('.pop-toggle'); await page.click('.pop .opt >> text=Test or quiz day');
  const s = await stored(page);
  const ids = s.screens.flatMap(sc => sc.widgets.map(w => w.id));
  expect(new Set(ids).size).toBe(ids.length);
  // The board tint follows the chosen colors; Screen settings has no Background choice.
  await page.click('#bGear'); await page.click('.pop >> text=Screen settings');
  await expect(page.locator('.pop')).not.toContainText('Background');
});

test('every starter fits on screen without widgets overlapping', async ({ page }) => {
  await openApp(page);
  const names = ['Slides', 'Warm up', 'Seats and warm up', 'Work time', 'Test or quiz day', 'Groups'];
  for (const n of names) {
    await page.click('.tab.add');
    await page.click('.pop-toggle');
    await page.click('.pop .opt >> text=' + n);
    const boxes = await page.$$eval('.widget', ws => ws.map(w => { const r = w.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
    const board = await page.$eval('#board', b => { const r = b.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
    for (const b of boxes) { expect(b[0]).toBeGreaterThanOrEqual(board[0] - 1); expect(b[2]).toBeLessThanOrEqual(board[2] + 1); expect(b[3]).toBeLessThanOrEqual(board[3] + 1); }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], c = boxes[j];
      expect(a[0] < c[2] - 1 && c[0] < a[2] - 1 && a[1] < c[3] - 1 && c[1] < a[3] - 1, n + ' widgets ' + i + ' and ' + j + ' overlap').toBe(false);
    }
  }
});
