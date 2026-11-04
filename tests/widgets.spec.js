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
  await expect(page.locator('.wtile span:last-child')).toHaveText(['Agenda', 'Timer', 'Clock', 'Seating chart', 'Task steps', 'Text box', 'Image', 'Names and groups', 'Music', 'Slides', 'Document', 'Dice', 'Points']);
});

test('slides: PowerPoint, SharePoint, and Google links become embeddable addresses', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const f = window.classboardTest.slidesURL;
    return [
      f('<iframe src="https://onedrive.live.com/embed?resid=ABC%21123&amp;authkey=!xyz&amp;em=2" width="402" height="327"></iframe>'),
      f('https://onedrive.live.com/redir?resid=ABC%21123&authkey=!xyz'),
      f('https://yorkprep-my.sharepoint.com/:p:/g/personal/teacher/EXabc?e=k1'),
      f('https://yorkprep.sharepoint.com/_layouts/15/Doc.aspx?sourcedoc={1}&action=edit'),
      f('https://docs.google.com/presentation/d/1AbC_d-9/edit#slide=id.p'),
      f('https://docs.google.com/presentation/d/e/2PACX-1vT/pub?start=false'),
      f('https://1drv.ms/p/s!abc'),
      f('https://example.com/deck.pptx'),
    ].map(x => x.src || 'ERROR: ' + x.error);
  });
  expect(r[0]).toBe('https://onedrive.live.com/embed?resid=ABC%21123&authkey=!xyz&em=2');
  expect(r[1]).toBe('https://onedrive.live.com/embed?resid=ABC%21123&authkey=!xyz&em=2');
  expect(r[2]).toBe('https://yorkprep-my.sharepoint.com/:p:/g/personal/teacher/EXabc?e=k1&action=embedview');
  expect(r[3]).toBe('https://yorkprep.sharepoint.com/_layouts/15/Doc.aspx?sourcedoc={1}&action=embedview');
  expect(r[4]).toBe('https://docs.google.com/presentation/d/1AbC_d-9/embed?start=false&loop=false');
  expect(r[5]).toBe('https://docs.google.com/presentation/d/e/2PACX-1vT/embed?start=false&loop=false');
  expect(r[6]).toMatch(/^ERROR: Short 1drv\.ms links/);
  expect(r[7]).toMatch(/^ERROR: That link is not from OneDrive/);
});

test('slides: pasting a link shows the deck, and Change keeps a way back', async ({ page }) => {
  await page.route(/onedrive\.live\.com|sharepoint\.com/, route => route.fulfill({ body: '<p>slides</p>', contentType: 'text/html' }));
  await openApp(page, board([widget('slides', { url: '' }, [0.05, 0.05, 0.6, 0.7])]));
  await page.fill('.slides textarea', 'https://example.com/x');
  await page.click('.slides >> text=Show slides');
  await expect(page.locator('.slides .sl-err')).toContainText('not from OneDrive');
  await page.fill('.slides textarea', 'https://yorkprep-my.sharepoint.com/:p:/g/personal/teacher/EXabc?e=k1');
  await page.click('.slides >> text=Show slides');
  await expect(page.locator('.slides iframe')).toHaveAttribute('src', /action=embedview/);
  await page.click('[title="Use a different presentation"]');
  await page.click('.slides >> text=Back to the presentation');
  await expect(page.locator('.slides iframe')).toHaveCount(1);
});

test('document: Word, Google Docs, Sheets, and Drive PDFs become embeddable addresses', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const f = window.classboardTest.officeURL;
    return [
      f('https://yorkprep-my.sharepoint.com/:w:/g/personal/teacher/EWdoc?e=x1'),
      f('https://yorkprep-my.sharepoint.com/:b:/g/personal/teacher/EBpdf?e=x2'),
      f('https://docs.google.com/document/d/1Doc-id/edit'),
      f('https://docs.google.com/spreadsheets/d/1Sheet/edit#gid=0'),
      f('https://drive.google.com/file/d/1PdfFile/view?usp=sharing'),
      f('https://drive.google.com/open?id=1Other'),
    ].map(x => x.src || 'ERROR: ' + x.error);
  });
  expect(r).toEqual([
    'https://yorkprep-my.sharepoint.com/:w:/g/personal/teacher/EWdoc?e=x1&action=embedview',
    'https://yorkprep-my.sharepoint.com/:b:/g/personal/teacher/EBpdf?e=x2&action=embedview',
    'https://docs.google.com/document/d/1Doc-id/preview',
    'https://docs.google.com/spreadsheets/d/1Sheet/preview',
    'https://drive.google.com/file/d/1PdfFile/preview',
    'https://drive.google.com/file/d/1Other/preview',
  ]);
});

test('dice: roll any number of dice, and the total matches', async ({ page }) => {
  await openApp(page, board([widget('dice', { n: 3, sides: 20, vals: [] })]));
  await page.click('.dice >> text=Roll');
  await expect(page.locator('.dice .btn.primary')).toBeEnabled();
  await expect(page.locator('.dice-total')).toHaveText(/^Total: \d+$/);
  const vals = (await page.locator('.die').allTextContents()).map(Number);
  expect(vals).toHaveLength(3);
  vals.forEach(v => expect(v).toBeGreaterThanOrEqual(1) && expect(v).toBeLessThanOrEqual(20));
  expect(await page.locator('.dice-total').textContent()).toBe('Total: ' + vals.reduce((a, b) => a + b, 0));
  await page.selectOption('.dice select[aria-label=Sides]', '6');
  await page.click('.dice >> text=Roll');
  await expect(page.locator('.die.pips')).toHaveCount(3);
});

test('points: the class works toward a goal by default, and teams are optional', async ({ page }) => {
  await openApp(page, board([widget('points', { mode: 'class', goal: 3, reward: 'free time', pts: 0, teams: [] })]));
  for (let i = 0; i < 3; i++) await page.click('[aria-label="Give the class a point"]');
  await expect(page.locator('.pt-msg')).toHaveText('Goal reached: free time');
  await page.click('[aria-label="Take a point away"]');
  await expect(page.locator('.pt-msg')).toHaveText('Working toward: free time');
  await page.click('.points >> text=Teams');
  await expect(page.locator('.pt-card')).toHaveCount(2);
  await page.click('.points >> text=+ Team');
  await expect(page.locator('.pt-card')).toHaveCount(3);
  await page.click('[aria-label="Give a point to Team 2"]');
  const d = (await stored(page)).screens[0].widgets[0].data;
  expect(d.pts).toBe(2);
  expect(d.teams.map(t => t.pts)).toEqual([0, 1, 0]);
});
