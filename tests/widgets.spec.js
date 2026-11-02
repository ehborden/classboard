const { test, expect } = require('@playwright/test');
const { openApp, stored, settle, board, widget } = require('./helpers');

const agendaBoard = () => board([widget('agenda', { title: 'Today', items: ['Do now', 'Mini lesson', 'Practice', 'Share out', 'Exit ticket'].map((t, i) => ({ id: 'a' + i, txt: t, done: false })) })]);
const rowsState = page => page.$$eval('.ag-row', rs => rs.map(r => (r.classList.contains('now') ? '>' : '') + r.querySelector('.ag-txt').value));

test('agenda: the first unchecked row is current, with no times', async ({ page }) => {
  await openApp(page, agendaBoard());
  await expect(page.locator('.ag-row.now .ag-txt')).toHaveValue('Do now');
  await page.locator('.ag-chk').nth(0).click();
  await page.locator('.ag-chk').nth(1).click();
  await expect(page.locator('.ag-row.now .ag-txt')).toHaveValue('Practice');
  await expect(page.locator('input[type=time]')).toHaveCount(0);
});

test('agenda: Enter adds a row, and Present shows now plus the next two', async ({ page }) => {
  await openApp(page, agendaBoard());
  await page.locator('.ag-txt').nth(4).press('Enter');
  await page.keyboard.type('Pack up');
  expect(await rowsState(page)).toEqual(['>Do now', 'Mini lesson', 'Practice', 'Share out', 'Exit ticket', 'Pack up']);
  await page.locator('.ag-chk').nth(0).click();
  await page.click('#bPresent');
  const visible = await page.$$eval('.ag-row', rs => rs.filter(r => getComputedStyle(r).display !== 'none').map(r => r.querySelector('.ag-txt').value));
  expect(visible).toEqual(['Mini lesson', 'Practice', 'Share out']);
});

test('agenda: drag the handle to reorder rows', async ({ page }) => {
  await openApp(page, agendaBoard());
  const grip = await page.locator('.ag-grip').nth(4).boundingBox();
  const target = await page.locator('.ag-row').nth(1).boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 4, target.y + 3, { steps: 8 });
  await page.mouse.up();
  expect((await stored(page)).screens[0].widgets[0].data.items.map(i => i.txt)).toEqual(['Do now', 'Exit ticket', 'Mini lesson', 'Practice', 'Share out']);
});

test('timer: presets, typed times, and a silent default', async ({ page }) => {
  await openApp(page, board([widget('timer', { dur: 300 })]));
  const center = page.locator('.timer .dialbox svg text').last();
  await page.click('.timer >> text=3 min'); await expect(center).toHaveText('3:00');
  await page.fill('.timer .tin', '2:30'); await page.press('.timer .tin', 'Enter'); await expect(center).toHaveText('2:30');
  await page.fill('.timer .tin', '7'); await page.press('.timer .tin', 'Enter'); await expect(center).toHaveText('7:00');
  await page.click('.timer [aria-label="One minute more"]'); await expect(center).toHaveText('8:00');

  await page.evaluate(() => {
    window.beeps = 0;
    const make = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () { window.beeps++; return make.call(this); };
  });
  for (let i = 0; i < 10; i++) await page.click('.timer [aria-label="One minute less"]');
  await page.click('.timer .btn.primary');
  await expect(page.locator('.widget:has(.timer)')).toHaveClass(/done/, { timeout: 15000 });
  expect(await page.evaluate(() => window.beeps)).toBe(0);
  await expect(page.locator('.widget:has(.timer)')).toHaveCSS('animation-name', 'none');
});

test('task steps: five at most, and the current step is the first unchecked', async ({ page }) => {
  await openApp(page, board([widget('steps', { title: 'Steps', items: [] })]));
  for (let i = 0; i < 5; i++) await page.click('[title="Add a step"]');
  await expect(page.locator('.st-row')).toHaveCount(5);
  await expect(page.locator('.tb >> text=+ Step')).toBeDisabled();
  await page.locator('.st-chk').nth(0).click();
  await expect(page.locator('.st-row').nth(1)).toHaveClass(/cur/);
});

test('minimize keeps a widget on the board and survives a reload', async ({ page }) => {
  await openApp(page);
  const t = page.locator('.widget:has(.timer)');
  await t.locator('[title="Minimize this widget"]').click(); await settle(page);
  expect((await t.boundingBox()).height).toBeLessThan(50);
  await page.reload();
  expect((await page.locator('.widget:has(.timer)').boundingBox()).height).toBeLessThan(50);
});

test('new screens use the default layout, and the board name can be edited', async ({ page }) => {
  await openApp(page);
  await page.click('.tab.add');
  await expect(page.locator('.widget .wlabel')).toHaveText(['Agenda', 'Text box', 'Clock', 'Timer']);
  await page.fill('#brand', 'Room 204'); await page.press('#brand', 'Enter'); await settle(page);
  await page.reload();
  await expect(page.locator('#brand')).toHaveValue('Room 204');
  await expect(page).toHaveTitle('Room 204');
});

test('calm mode keeps a clock on screen and turns music off', async ({ page }) => {
  await openApp(page, board([widget('music', { url: 'https://open.spotify.com/playlist/37i9dQZF1DX8NTLI2TtZa6' })]));
  await page.click('#bGear'); await page.click('.pop >> text=Calm mode: off');
  await expect(page.locator('.calm-clock')).toBeVisible();
  await expect(page.locator('.music')).toContainText('Music is off in calm mode.');
});

test('the Add widget menu is a grid in the chosen order', async ({ page }) => {
  await openApp(page);
  await page.click('#bAdd');
  await expect(page.locator('.wtile span:last-child')).toHaveText(['Agenda', 'Timer', 'Clock', 'Seating chart', 'Task steps', 'Text box', 'Image', 'Names and groups', 'Music']);
});
