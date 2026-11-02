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
