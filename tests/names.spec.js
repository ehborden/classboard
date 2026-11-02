// Unit checks for the name reader, through the read-only window.classboardTest hook.
const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

test('reads names from messy text', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const T = window.classboardTest, f = t => T.namesFromText(t).map(n => n.first + '|' + n.last);
    return {
      list: f("1. Maya Rodriguez\n2. Leo Chen\n3) Sam\n- Ava-Marie O'Neil\n• Noah Smith"),
      lastFirst: f('Smith, John\nGARCIA, MARIA\nLee, Ana Sofia'),
      junk: f('English 9 - Period 2\nName\nStudent\nPage 1 of 2\nZoe Park  zpark@school.org  10\n12345\nTeacher: Ms Borden'),
      tsv: f('First Name\tLast Name\tGrade\nMaya\tRodriguez\t9\nLeo\tChen\t9'),
    };
  });
  expect(r.list).toEqual(['Maya|Rodriguez', 'Leo|Chen', 'Sam|', "Ava-Marie|O'Neil", 'Noah|Smith']);
  expect(r.lastFirst).toEqual(['John|Smith', 'Maria|Garcia', 'Ana Sofia|Lee']);
  expect(r.junk).toEqual(['Zoe|Park']);
  expect(r.tsv).toEqual(['Maya|Rodriguez', 'Leo|Chen']);
});

test('reads spreadsheet columns, preferring a preferred name', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const T = window.classboardTest;
    return T.namesFromRows(T.parseCSV('Student ID,Last Name,First Name,Preferred Name\n1,Smith,Jonathan,Jon\n2,"Garcia, Jr.",Maria,\n', ',')).map(n => n.first + '|' + n.last);
  });
  expect(r).toEqual(['Jon|Smith', 'Maria|Garcia, Jr.']);
});

test('formats names three ways, adding an initial when first names repeat', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => ['full', 'initial', 'first'].map(k =>
    window.classboardTest.formatNames([{ first: 'Sam', last: 'Lee' }, { first: 'Sam', last: 'Ortiz' }, { first: 'Ava', last: 'Park' }], k).join(', ')));
  expect(r).toEqual(['Sam Lee, Sam Ortiz, Ava Park', 'Sam L, Sam O, Ava P', 'Sam L, Sam O, Ava']);
});
