const { test, expect } = require('@playwright/test');
const { openApp, stored } = require('./helpers');

const inked = page => page.evaluate(() => {
  const c = document.querySelector('.pen-layer'); if (!c) return 0;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});
async function stroke(page, x1, y1, x2, y2) {
  await page.mouse.move(x1, y1); await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 12 }); await page.mouse.up();
}

test('draw on the board, undo a stroke, and Done lets clicks reach widgets again', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#bPen');
  await expect(page.locator('.pen-bar')).toBeVisible();
  await stroke(page, 300, 300, 700, 400);
  expect(await inked(page)).toBeGreaterThan(100);
  await page.click('.pen-bar >> text=Highlighter');
  await stroke(page, 300, 500, 700, 500);
  const both = await inked(page);
  await page.click('.pen-bar >> text=Undo');
  expect(await inked(page)).toBeLessThan(both);

  await page.click('.pen-bar >> text=Done');
  await expect(page.locator('.pen-bar')).toBeHidden();
  expect(await inked(page)).toBeGreaterThan(100);
  await page.locator('.agenda .ag-chk').first().click();
  await expect(page.locator('.agenda .ag-chk').first()).toHaveClass(/on/);
  expect(errors).toEqual([]);
});

test('pen marks clear on a screen switch and are never saved', async ({ page }) => {
  await openApp(page);
  await page.click('#bPen');
  await stroke(page, 300, 300, 700, 400);
  await page.keyboard.press('Escape');
  await expect(page.locator('.pen-bar')).toBeHidden();
  const s = await stored(page);
  expect(JSON.stringify(s)).not.toMatch(/strokes|pts/);
  await page.click('.tab.add');
  expect(await inked(page)).toBe(0);
});
