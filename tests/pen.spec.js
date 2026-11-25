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

test('full screen: Pen and Save as PDF are one click away, and the pen draws over the widget', async ({ page }) => {
  await openApp(page, board([widget('text', { html: '<b>Notes</b>', fs: 40 }, [0.05, 0.1, 0.6, 0.5])]));
  await page.click('.widget .tb[title="Full size"]');
  await expect(page.locator('.widget.full .full-pen')).toBeVisible();
  await expect(page.locator('.widget.full .full-save')).toBeVisible();
  await page.click('.widget.full .full-pen');
  await expect(page.locator('.pen-bar')).toBeVisible();
  // The pen bar fits on one row, so it does not cover the widget more than it has to.
  expect((await page.locator('.pen-bar').boundingBox()).height).toBeLessThan(60);
  await expect(page.locator('.widget.full .full-pen')).toBeHidden();
  await page.mouse.move(200, 300); await page.mouse.down(); await page.mouse.move(500, 320, { steps: 6 }); await page.mouse.up();
  expect(await inked(page)).toBeGreaterThan(200);
  await page.click('.pen-bar >> text=Done');
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.click('.widget.full .full-save');
  expect((await dl).suggestedFilename()).toBe('Classboard Screen 1.pdf');
});

test('a Slides screen is saved by capturing the tab, since the slide is another site\'s frame', async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = 0;
    navigator.mediaDevices.getDisplayMedia = async () => {
      window.__shared++;
      const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight;
      const g = c.getContext('2d'); let n = 0;
      setInterval(() => { g.fillStyle = n++ % 2 ? '#c9e2ff' : '#c9e2fe'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#0a3ca3'; g.fillRect(100, 100, 300, 120); }, 50);
      return c.captureStream(20);
    };
  });
  await openApp(page, board([widget('slides', { url: 'https://onedrive.live.com/embed?cid=AB12&resid=AB12%21123&authkey=XYZ&em=2' }, [0.02, 0.02, 0.95, 0.9])]));
  await expect(page.locator('.slides iframe, .wbody iframe').first()).toBeVisible();
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.click('#bPen');
  await page.click('.pen-bar >> text=Save as PDF');
  const d = await dl;
  expect(await page.evaluate(() => window.__shared)).toBe(1);
  expect(d.suggestedFilename()).toBe('Classboard Screen 1.pdf');
  expect(require('fs').readFileSync(await d.path()).slice(0, 5).toString()).toBe('%PDF-');
  // The buttons are shown again afterward.
  await expect(page.locator('.pen-bar')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/capturing/);
});
