const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { openApp, stored, settle, board, widget } = require('./helpers');

const FIX = path.join(__dirname, '..', 'test-results', 'pdf-fixtures');
const PDF = path.join(FIX, 'reading.pdf');

test.beforeAll(async () => {
  if (fs.existsSync(PDF)) return;
  fs.mkdirSync(FIX, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<style>section{page-break-after:always;font:40px Arial;padding:60px}</style>' +
    [1, 2, 3].map(n => `<section>Reading, page ${n}</section>`).join(''));
  await p.pdf({ path: PDF, format: 'Letter' });
  await b.close();
});

const inkCount = page => page.evaluate(() => {
  const c = document.querySelector('.pdf-ink'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n;
});
async function scribble(page) {
  const r = await page.locator('.pdf-ink').boundingBox();
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.3); await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.4, { steps: 10 }); await page.mouse.up();
}
const docBoard = () => board([widget('doc', { url: '' }, [0.05, 0.03, 0.6, 0.94])]);

test('an uploaded PDF shows pages, keeps marks per page, and is gone after reload unless kept', async ({ page }) => {
  const errors = await openApp(page, docBoard());
  await page.setInputFiles('.doc input[type=file]', PDF);
  await expect(page.locator('.pdf-label')).toHaveText('Page 1 of 3', { timeout: 20000 });
  await page.click('.pdf-bar >> text=Draw');
  await scribble(page);
  expect(await inkCount(page)).toBeGreaterThan(50);
  await page.click('[aria-label="Next page"]');
  await expect(page.locator('.pdf-label')).toHaveText('Page 2 of 3');
  expect(await inkCount(page)).toBe(0);
  await page.click('[aria-label="Previous page"]');
  await expect.poll(() => inkCount(page)).toBeGreaterThan(50);
  await expect(page.locator('.pdf-keep')).toHaveText('Keep PDF and marks');
  await settle(page);
  await page.reload();
  await expect(page.locator('.doc >> text=Or upload a PDF')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Keep saves the PDF and its marks; later marks need Save changes', async ({ page }) => {
  await openApp(page, docBoard());
  await page.setInputFiles('.doc input[type=file]', PDF);
  await expect(page.locator('.pdf-label')).toHaveText('Page 1 of 3', { timeout: 20000 });
  await page.click('.pdf-bar >> text=Draw');
  await scribble(page);
  await page.click('.pdf-keep');
  await expect(page.locator('.pdf-keep')).toBeHidden();
  const s = await stored(page);
  const pdf = s.screens[0].widgets[0].data.pdf;
  expect(pdf.name).toBe('reading.pdf');
  expect(pdf.marks['1']).toHaveLength(1);
  expect(JSON.stringify(s).length).toBeLessThan(20000);

  await page.reload();
  await expect(page.locator('.pdf-label')).toHaveText('Page 1 of 3', { timeout: 20000 });
  await expect.poll(() => inkCount(page)).toBeGreaterThan(50);
  await page.click('.pdf-bar >> text=Draw');
  await scribble(page);
  await expect(page.locator('.pdf-keep')).toHaveText('Save changes');
});

test('backups carry kept PDFs and restore them', async ({ page }, info) => {
  await openApp(page, docBoard());
  await page.setInputFiles('.doc input[type=file]', PDF);
  await expect(page.locator('.pdf-label')).toHaveText('Page 1 of 3', { timeout: 20000 });
  await page.click('.pdf-keep'); await settle(page);
  await page.click('#bGear'); await page.click('.pop >> text=Backup');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Download backup')]);
  const file = info.outputPath('b.json'); await dl.saveAs(file);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(Object.keys(j.files)).toHaveLength(1);

  const fresh = await page.context().browser().newContext();
  const p2 = await fresh.newPage();
  await openApp(p2);
  await p2.click('#bGear'); await p2.click('.pop >> text=Backup');
  await p2.setInputFiles('.pop input[type=file]', file);
  await Promise.all([p2.waitForEvent('download'), p2.click('text=Replace my boards')]);
  await expect(p2.locator('.pdf-label')).toHaveText('Page 1 of 3', { timeout: 20000 });
  await fresh.close();
});

test('leaving with an unkept PDF asks first; a kept PDF with no new marks does not', async ({ page, context }) => {
  await openApp(page, docBoard());
  await page.setInputFiles('.doc input[type=file]', PDF);
  await expect(page.locator('.pdf-label')).toHaveText('Page 1 of 3', { timeout: 20000 });
  const asked = new Promise(res => page.once('dialog', d => { res(d.type()); d.dismiss(); }));
  await page.close({ runBeforeUnload: true });
  expect(await asked).toBe('beforeunload');

  const p2 = await context.newPage();
  await openApp(p2, docBoard());
  await p2.setInputFiles('.doc input[type=file]', PDF);
  await expect(p2.locator('.pdf-label')).toHaveText('Page 1 of 3', { timeout: 20000 });
  await p2.click('.pdf-keep'); await settle(p2);
  let dialogs = 0; p2.on('dialog', d => { dialogs++; d.accept(); });
  await p2.close({ runBeforeUnload: true });
  expect(dialogs).toBe(0);
});

test('switching away from a PDF closes its document instead of piling them up', async ({ page }) => {
  // Each open PDF runs its own background worker, so count the live ones.
  await page.addInitScript(() => {
    window.liveWorkers = 0;
    const W = window.Worker;
    window.Worker = class extends W {
      constructor(...a) { super(...a); window.liveWorkers++; }
      terminate() { if (!this._ended) { this._ended = true; window.liveWorkers--; } return super.terminate(); }
    };
  });
  const s = docBoard(); s.screens.push({ id: 's2', name: 'Other', bg: 'mist', widgets: [] });
  await openApp(page, s);
  await page.setInputFiles('.doc input[type=file]', PDF);
  await expect(page.locator('.pdf-label')).toHaveText('Page 1 of 3', { timeout: 20000 });
  for (let i = 0; i < 4; i++) {
    await page.click('.tab >> text=Other');
    await page.click('.tab >> text=Screen 1');
    await expect(page.locator('.pdf-label')).toHaveText('Page 1 of 3', { timeout: 20000 });
  }
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.liveWorkers)).toBeLessThanOrEqual(1);
});
