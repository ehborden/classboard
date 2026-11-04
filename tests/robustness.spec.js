// Checks for problems found in code review: background timers, two tabs, broken widgets,
// saved-data defaults, undo while typing, unsafe imported HTML, and the confirm-button color.
const { test, expect } = require('@playwright/test');
const { APP, openApp, stored, settle, board, widget } = require('./helpers');

const countBeeps = page => page.evaluate(() => {
  window.beeps = 0;
  const make = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () { window.beeps++; return make.call(this); };
});

test('a timer with Bell on rings on time even while another screen is showing', async ({ page }) => {
  const s = board([widget('timer', { dur: 10, bell: true })]);
  s.screens.push({ id: 's2', name: 'Slides', bg: 'mist', widgets: [] });
  await openApp(page, s);
  await countBeeps(page);
  await page.click('.timer .btn.primary');
  await page.click('.tab >> text=Slides');
  await page.waitForTimeout(11500);
  expect(await page.evaluate(() => window.beeps)).toBe(3);
  await page.click('.tab >> text=Screen 1');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.beeps)).toBe(3);
  await expect(page.locator('.widget:has(.timer)')).toHaveClass(/done/);
});

test('closing an older tab does not overwrite newer work from another tab', async ({ context }) => {
  const tab1 = await context.newPage(); await openApp(tab1);
  const tab2 = await context.newPage(); await tab2.goto(APP);
  await tab2.fill('#brand', 'Room 204'); await tab2.press('#brand', 'Enter'); await settle(tab2);
  await expect(tab1.locator('#brand')).toHaveValue('Room 204');
  await tab2.close({ runBeforeUnload: true });
  await tab1.close({ runBeforeUnload: true });
  const tab3 = await context.newPage(); await tab3.goto(APP);
  await expect(tab3.locator('#brand')).toHaveValue('Room 204');
});

test('one broken widget does not blank the rest of the screen', async ({ page }) => {
  const errors = await openApp(page, board([
    widget('seats', { classId: 'c1', items: 'not a list', seats: {} }, [0.02, 0.03, 0.3, 0.3]),
    widget('clock', { h24: false, sec: false, date: true }, [0.5, 0.03, 0.3, 0.3]),
  ]));
  await expect(page.locator('.widget:has(.wlabel:text-is("Seating chart"))')).toContainText('This widget could not load');
  await expect(page.locator('.clock .time')).toBeVisible();
  expect(errors).toEqual([]);
});

test('saved widgets get defaults for fields they are missing', async ({ page }) => {
  await openApp(page, board([widget('points', { mode: 'class' })]));
  await expect(page.locator('.pt-of')).toHaveText(' of 20');
  await expect(page.locator('.pt-msg')).toHaveText('Working toward: 5 free minutes');
  await page.click('[aria-label="Give the class a point"]');
  const d = (await stored(page)).screens[0].widgets[0].data;
  expect([d.goal, d.reward, d.pts]).toEqual([20, '5 free minutes', 1]);
});

test('typing in one box is one undo step, so earlier changes stay reachable', async ({ page }) => {
  await openApp(page);
  const rm = page.locator('.widget:has(.wlabel:text-is("Clock")) [title="Remove this widget"]');
  await rm.click(); await rm.click(); await settle(page);
  await page.click('.text .ed'); await page.keyboard.press('Control+End');
  for (const word of [' one', ' two', ' three', ' four']) { await page.keyboard.type(word); await page.waitForTimeout(450); }
  await page.mouse.click(700, 780);
  await page.click('#bUndo');
  await expect(page.locator('.text .ed')).not.toContainText('one');
  await page.click('#bUndo');
  await expect(page.locator('.widget:has(.wlabel:text-is("Clock"))')).toHaveCount(1);
});

test('script hidden in imported text box HTML does not run', async ({ page }) => {
  await openApp(page, board([widget('text', { fs: 28, html: '<b>Hi</b><img src="x" onerror="window.pwned=1"><script>window.pwned=2</script><a href="javascript:window.pwned=3">x</a>' })]));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  await expect(page.locator('.text .ed b')).toHaveText('Hi');
  expect(await page.locator('.text .ed').innerHTML()).not.toMatch(/onerror|script|javascript:/i);
});

test('confirm buttons are not red', async ({ page }) => {
  await openApp(page);
  const rm = page.locator('.widget:has(.wlabel:text-is("Clock")) [title="Remove this widget"]');
  await rm.click();
  await page.mouse.move(700, 780);
  const bg = await rm.evaluate(e => getComputedStyle(e).backgroundColor);
  const [r, g, b] = bg.match(/\d+/g).map(Number);
  expect(r > 150 && g < 90 && b < 90).toBe(false);
});

test('an old starter board says Warm up, but a teacher\'s own Do now is left alone', async ({ page }) => {
  await openApp(page, board([
    widget('agenda', { title: 'Today', items: ['Do now', 'Mini lesson', 'Practice', 'Share out'].map((t, i) => ({ id: 'a' + i, txt: t, done: false })) }),
    widget('text', { fs: 32, html: '<b>Do now</b><br>Solve the first problem on your own.' }, [0.5, 0.03, 0.4, 0.3]),
    widget('agenda', { title: 'Mine', items: [{ id: 'x', txt: 'Do now', done: false }, { id: 'y', txt: 'Lab', done: false }] }, [0.5, 0.5, 0.4, 0.4]),
  ]));
  await expect(page.locator('.ag-txt').first()).toHaveValue('Warm up');
  await expect(page.locator('.text .ed b')).toHaveText('Warm up');
  await expect(page.locator('.ag-txt').nth(4)).toHaveValue('Do now');
});
