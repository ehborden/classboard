const { test, expect } = require('@playwright/test');
const { openApp, stored, addScreen, board, widget } = require('./helpers');
const fs = require('fs');

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
  await addScreen(page);
  expect(await inked(page)).toBe(0);
});

test('highlighter has its own colors, and the ink colors come back for the pen', async ({ page }) => {
  await openApp(page);
  await page.click('#bPen');
  await expect(page.locator('.pen-bar [aria-label="blue ink"]')).toBeVisible();
  await page.click('.pen-bar >> text=Highlighter');
  await expect(page.locator('.pen-bar [aria-label="blue ink"]')).toHaveCount(0);
  await expect(page.locator('.pen-bar [aria-label$="highlighter"]')).toHaveCount(5);
  await page.click('.pen-bar [aria-label="Green highlighter"]');
  await expect(page.locator('.pen-bar [aria-label="Green highlighter"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('.pen-bar >> text=Pen');
  await expect(page.locator('.pen-bar [aria-label="blue ink"]')).toBeVisible();
});

test('Save as PDF downloads the screen with the writing on it', async ({ page }) => {
  await openApp(page, board([widget('text', { html: '<b>Solve:</b> 3x + 5 = 20', fs: 48 }, [0.05, 0.1, 0.6, 0.5]), widget('timer', { dur: 300 }, [0.7, 0.1, 0.25, 0.6])]));
  await page.click('#bPen');
  await page.click('.pen-bar >> text=Highlighter');
  await page.mouse.move(150, 230); await page.mouse.down(); await page.mouse.move(450, 230, { steps: 8 }); await page.mouse.up();
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.click('.pen-bar >> text=Save as PDF');
  const d = await dl;
  expect(d.suggestedFilename()).toMatch(/^Classboard Screen 1\.pdf$/);
  const file = await d.path();
  const bytes = fs.readFileSync(file);
  expect(bytes.slice(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(8000);
  fs.mkdirSync('test-results', { recursive: true });
  fs.copyFileSync(file, 'test-results/saved-screen.pdf');
  await expect(page.locator('.pen-save')).toBeEnabled();
});

test('Save as PDF also works on a screen with agenda highlights', async ({ page }) => {
  await openApp(page, board([widget('agenda', { title: 'Today', items: ['Warm up', 'Practice'].map((t, i) => ({ id: 'a' + i, txt: t, done: i === 0 })) }, [0.05, 0.1, 0.4, 0.7])]));
  await page.click('#bPen');
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.click('.pen-bar >> text=Save as PDF');
  const d = await dl;
  const fs2 = require('fs'); const f = await d.path();
  fs2.copyFileSync(f, 'test-results/saved-agenda.pdf');
  expect(fs2.readFileSync(f).slice(0, 5).toString()).toBe('%PDF-');
});
