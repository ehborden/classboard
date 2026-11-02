const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { openApp, stored } = require('./helpers');

const KIDS = [['Rodriguez', 'Maya'], ['Chen', 'Leo'], ['Okafor', 'Ada'], ['Nguyen', 'Sam'], ['Park', 'Zoe'], ['Smith', 'Noah']];
const SHORT = ['Maya R', 'Leo C', 'Ada O', 'Sam N', 'Zoe P', 'Noah S'];
const FIX = path.join(__dirname, '..', 'test-results', 'roster-fixtures');

// Builds the roster fixtures once: CSV, Excel, a text PDF, a screenshot, and an image-only (scanned) PDF.
test.beforeAll(async () => {
  if (fs.existsSync(path.join(FIX, 'scan.pdf'))) return;
  fs.mkdirSync(FIX, { recursive: true });
  fs.writeFileSync(path.join(FIX, 'roster.csv'), 'Student ID,Last Name,First Name,Grade\n' + KIDS.map((k, i) => `${100 + i},${k[0]},${k[1]},9`).join('\n'));
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Last Name', 'First Name', 'Email'], ...KIDS.map(k => [k[0], k[1], k[1].toLowerCase() + '@school.org'])]), 'Roster');
  XLSX.writeFile(wb, path.join(FIX, 'roster.xlsx'));
  const html = `<style>body{font:22px Arial;padding:30px}td{padding:6px 18px}</style><h2>English 9 - Period 2</h2><table><tr><th>#</th><th>Student</th><th>Grade</th></tr>${KIDS.map((k, i) => `<tr><td>${i + 1}</td><td>${k[0]}, ${k[1]}</td><td>9</td></tr>`).join('')}</table>`;
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await p.setContent(html);
  await p.pdf({ path: path.join(FIX, 'roster.pdf') });
  await p.screenshot({ path: path.join(FIX, 'roster.png') });
  const img = fs.readFileSync(path.join(FIX, 'roster.png')).toString('base64');
  await p.setContent(`<img src="data:image/png;base64,${img}" style="width:700px">`);
  await p.pdf({ path: path.join(FIX, 'scan.pdf') });
  await browser.close();
});

async function newClass(page) {
  await page.click('#bGear'); await page.click('.pop >> text=Classes');
  await page.click('.modal >> text=+ Add a class');
  await page.fill('#clName', 'Period 3');
}

for (const file of ['roster.csv', 'roster.xlsx', 'roster.pdf', 'roster.png', 'scan.pdf']) {
  test(`import students from ${file}`, async ({ page }) => {
    test.setTimeout(180000);
    const errors = await openApp(page);
    await newClass(page);
    await page.setInputFiles('.modal input[type=file]', path.join(FIX, file));
    await expect(page.locator('#clMsg')).toContainText('Found 6 names', { timeout: 150000 });
    expect((await page.inputValue('.cl-paste textarea')).split('\n')).toEqual(SHORT);
    await page.click('.modal >> text=Full name');
    expect((await page.inputValue('.cl-paste textarea')).split('\n')).toEqual(KIDS.map(k => k[1] + ' ' + k[0]));
    await page.click('.modal >> text=Add these names');
    await expect(page.locator('.cl-nm')).toHaveCount(6);
    expect(errors).toEqual([]);
  });
}

test('pasting "Last, First" makes one student per line', async ({ page }) => {
  await openApp(page);
  await newClass(page);
  await page.click('.modal >> text=Or paste a list');
  await page.evaluate(() => {
    const ta = document.querySelector('.cl-paste textarea'), dt = new DataTransfer();
    dt.setData('text/plain', 'Smith, John\nGarcia, Maria\nLee, Ana');
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('.cl-paste textarea')).toHaveValue('John S\nMaria G\nAna L');
});

test('adding a student by name, and a repeat is caught', async ({ page }) => {
  await openApp(page);
  await newClass(page);
  for (const n of ['Maya R', 'Leo', 'Leo']) { await page.fill('#clOne', n); await page.press('#clOne', 'Enter'); }
  await expect(page.locator('#clMsg')).toContainText('Leo is already in this class');
  await expect(page.locator('.cl-nm')).toHaveText(['Maya R', 'Leo']);
  const cls = (await stored(page)).classes.find(c => c.name === 'Period 3');
  expect(cls.students).toEqual(['Maya R', 'Leo']);
});
