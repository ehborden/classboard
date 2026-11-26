const { test, expect } = require('@playwright/test');
const { openApp, stored, board, widget } = require('./helpers');

const seatBoard = () => board([widget('seats', { classId: 'c1', items: [], seats: {}, initials: false }, [0.02, 0.03, 0.96, 0.94])]);
const overlaps = page => page.$$eval('.seat-item', els => {
  const r = els.map(e => e.getBoundingClientRect()); let n = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], b = r[j];
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n++;
  }
  return n;
});

test('quick start builds table groups without overlaps', async ({ page }) => {
  await openApp(page, seatBoard());
  await expect(page.locator('.seat-qs')).toContainText('Start with a layout');
  await page.click('[aria-label="Fewer Tables"]'); await page.click('[aria-label="Fewer Tables"]');
  await page.click('text=Make tables');
  await expect(page.locator('.seat-table')).toHaveCount(4);
  await expect(page.locator('.seat-chair')).toHaveCount(16);
  expect(await overlaps(page)).toBe(0);
});

test('quick start builds rows of desks', async ({ page }) => {
  await openApp(page, seatBoard());
  await page.click('text=Make rows');
  await expect(page.locator('.seat-chair')).toHaveCount(24);
  expect(await overlaps(page)).toBe(0);
});

test('a selected piece shows its remove button, and Delete removes it', async ({ page }) => {
  await openApp(page, seatBoard());
  await page.click('text=Make rows');
  await page.locator('.seat-chair').first().click();
  await expect(page.locator('.seat-item.on .seat-x')).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(page.locator('.seat-chair')).toHaveCount(23);
});

test('seat by clicking, swap by dragging, and seats are kept per class', async ({ page }) => {
  await openApp(page, seatBoard());
  await page.click('text=Make rows');
  await page.click('text=2. Seat students');
  await page.click('.seat-tray .chip[title="Maya R"]'); await page.locator('.seat-chair').nth(0).click();
  await page.click('.seat-tray .chip[title="Leo C"]'); await page.locator('.seat-chair').nth(1).click();
  const from = await page.locator('.seat-chair').nth(1).locator('.seat-name').boundingBox();
  const to = await page.locator('.seat-chair').nth(0).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 }); await page.mouse.up();
  const names = await page.locator('.seat-chair .seat-name').allTextContents();
  expect(names.slice(0, 2)).toEqual(['Leo C', 'Maya R']);
  const seats = (await stored(page)).screens[0].widgets[0].data.seats;
  expect(Object.values(seats.c1).sort()).toEqual(['Leo C', 'Maya R']);
});

test('a class can be added from the seating chart', async ({ page }) => {
  await openApp(page, seatBoard());
  await page.click('text=Make rows');
  await page.click('text=2. Seat students');
  const before = (await stored(page)).classes.length;
  await page.click('.seat-bar >> text=+ Add a class');
  await expect(page.locator('#clName')).toBeFocused();
  await page.fill('#clName', 'Period 9');
  await page.click('.modal >> text=Done');
  expect((await stored(page)).classes.length).toBe(before + 1);
});

test('shift-click picks several chairs and dragging one moves them all', async ({ page }) => {
  await openApp(page, seatBoard());
  await page.click('text=Make rows');
  await page.locator('.seat-chair').nth(0).click();
  await page.locator('.seat-chair').nth(1).click({ modifiers: ['Shift'] });
  await expect(page.locator('.seat-item.on')).toHaveCount(2);
  const a = await page.locator('.seat-chair').nth(0).boundingBox();
  const b = await page.locator('.seat-chair').nth(1).boundingBox();
  const c = await page.locator('.seat-chair').nth(2).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 40, { steps: 6 }); await page.mouse.up();
  const a2 = await page.locator('.seat-chair').nth(0).boundingBox();
  const b2 = await page.locator('.seat-chair').nth(1).boundingBox();
  const c2 = await page.locator('.seat-chair').nth(2).boundingBox();
  expect(Math.round(a2.y - a.y)).toBe(40); expect(Math.round(b2.y - b.y)).toBe(40);
  expect(Math.round(c2.y - c.y)).toBe(0);
});

test('a box on empty floor picks pieces, and Tidy lines up scattered chairs in rows', async ({ page }) => {
  const items = [[.1, .2], [.3, .23], [.5, .18], [.12, .6], [.31, .64], [.52, .58]]
    .map(([x, y], i) => ({ id: 'k' + i, kind: 'chair', x, y, w: .1, h: .1, label: '' }));
  await openApp(page, board([widget('seats', { classId: 'c1', items, seats: {}, initials: false }, [0.02, 0.03, 0.96, 0.94])]));
  await page.click('text=1. Set up room');
  const cv = await page.locator('.seat-canvas').boundingBox();
  await page.mouse.move(cv.x + 5, cv.y + cv.height * .05); await page.mouse.down();
  await page.mouse.move(cv.x + cv.width * .7, cv.y + cv.height * .4, { steps: 8 }); await page.mouse.up();
  await expect(page.locator('.seat-item.on')).toHaveCount(3);
  await page.click('text=Tidy chosen into rows');
  const ys = await page.$$eval('.seat-chair', els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(ys.slice(0, 3)).size).toBe(1);
  expect(new Set(ys.slice(3)).size).toBeGreaterThan(1);
  await page.mouse.click(cv.x + cv.width * .9, cv.y + cv.height * .9);
  await page.click('text=Tidy into rows');
  const ys2 = await page.$$eval('.seat-chair', els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(ys2).size).toBe(2);
  expect(await overlaps(page)).toBe(0);
});
