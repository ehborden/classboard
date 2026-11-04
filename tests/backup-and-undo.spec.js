const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { openApp, stored, settle, addScreen } = require('./helpers');

test('download a backup, change the board, then import it back', async ({ page }, info) => {
  const errors = await openApp(page);
  await page.click('#bGear'); await page.click('.pop >> text=Backup');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Download backup')]);
  expect(dl.suggestedFilename()).toMatch(/^Classboard backup \d{4}-\d{2}-\d{2}\.json$/);
  const file = info.outputPath('backup.json'); await dl.saveAs(file);

  await addScreen(page);
  await expect(page.locator('.tab:not(.add)')).toHaveCount(2);

  await page.click('#bGear'); await page.click('.pop >> text=Backup');
  await page.setInputFiles('.pop input[type=file]', file);
  await expect(page.locator('.pop')).toContainText('This file has 1 screen and 1 class.');
  const [before] = await Promise.all([page.waitForEvent('download'), page.click('text=Replace my boards')]);
  expect(before.suggestedFilename()).toMatch(/before import\.json$/);
  await expect(page.locator('.tab:not(.add)')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('importing a file that is not a backup leaves the boards alone', async ({ page }, info) => {
  await openApp(page);
  const bad = info.outputPath('bad.json'); fs.writeFileSync(bad, '{"x":1}');
  await page.click('#bGear'); await page.click('.pop >> text=Backup');
  await page.setInputFiles('.pop input[type=file]', bad);
  await expect(page.locator('#toasts')).toContainText('not a Classboard backup');
});

test('Undo brings back a removed widget, and Cmd+Z works outside text fields', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#bUndo')).toBeDisabled();
  const rm = page.locator('.widget:has(.wlabel:text-is("Clock")) [title="Remove this widget"]');
  await rm.click(); await rm.click(); await settle(page);
  await expect(page.locator('.widget:has(.wlabel:text-is("Clock"))')).toHaveCount(0);
  await page.click('#bUndo');
  await expect(page.locator('.widget:has(.wlabel:text-is("Clock"))')).toHaveCount(1);

  await page.locator('.agenda .ag-chk').first().click(); await settle(page);
  await page.mouse.click(700, 760);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.agenda .ag-chk').first()).not.toHaveClass(/on/);
});

test('switching screens is not an undo step', async ({ page }) => {
  await openApp(page);
  await addScreen(page); await settle(page);
  await page.click('.tab >> text=Screen 1'); await settle(page);
  await page.click('#bUndo');
  await expect(page.locator('.tab:not(.add)')).toHaveCount(1);
  await expect(page.locator('.tab.on')).toHaveText('Screen 1');
});

test('Undo restores a deleted class', async ({ page }) => {
  await openApp(page);
  await page.click('#bGear'); await page.click('.pop >> text=Classes');
  await page.click('.modal >> text=Delete class'); await page.click('.modal >> text=Click again to delete');
  await page.click('.modal >> text=Done');
  expect((await stored(page)).classes).toHaveLength(0);
  await page.click('#bUndo');
  expect((await stored(page)).classes).toHaveLength(1);
});

test('a backup reminder appears after a week with no backup', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('classboard.v1', JSON.stringify({ v: 1, since: Date.now() - 10 * 864e5, classes: [], screens: [{ id: 's', name: 'Screen 1', bg: 'mist', widgets: [] }], active: 's' }));
  });
  await openApp(page);
  await expect(page.locator('#toasts')).toContainText('You have not downloaded a backup yet.', { timeout: 5000 });
});
