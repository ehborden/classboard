// Shared setup for the Classboard tests.
// Each test runs in a fresh browser context, so localStorage starts empty and nothing touches real data.
const path = require('path');
const fs = require('fs');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const KEY = 'classboard.v1';
const NM = path.resolve(__dirname, '..', 'node_modules');

// The app loads its import helpers from CDNs. Tests serve the same pinned versions from
// node_modules instead, so they run offline and check the exact code the browser will run.
const CDN = [
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/0\.18\.5\/(.*)$/, 'xlsx/dist/'],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/3\.11\.174\/(.*)$/, 'pdfjs-dist/build/'],
  [/cdn\.jsdelivr\.net\/npm\/tesseract\.js@5\.1\.1\/dist\/(.*)$/, 'tesseract.js/dist/'],
  [/cdn\.jsdelivr\.net\/npm\/tesseract\.js-core@5\.1\.1\/(.*)$/, 'tesseract.js-core/'],
  [/cdn\.jsdelivr\.net\/npm\/@tesseract\.js-data\/eng@1\.0\.0\/(.*)$/, '@tesseract.js-data/eng/'],
];
const TYPES = { '.js': 'application/javascript', '.wasm': 'application/wasm' };

async function serveLibs(context) {
  await context.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, route => {
    const url = route.request().url();
    for (const [re, dir] of CDN) {
      const m = url.match(re);
      const file = m && path.join(NM, dir, m[1]);
      if (file && fs.existsSync(file)) {
        return route.fulfill({
          path: file,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' },
        });
      }
    }
    return route.abort();
  });
}

// Opens the app, optionally seeded with saved state (only on the first load, so reloads keep later changes).
async function openApp(page, state) {
  await serveLibs(page.context());
  if (state) {
    await page.addInitScript(([key, s]) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(key, JSON.stringify(s));
      }
    }, [KEY, state]);
  }
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(APP);
  return errors;
}

// Saves are debounced by 300 ms; wait past that before reading storage.
async function settle(page) { await page.waitForTimeout(450); }

async function stored(page) {
  await settle(page);
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
}

// A small saved state with one screen holding the given widgets.
function board(widgets, extra) {
  return Object.assign({
    v: 1, active: 's1', since: Date.now(),
    classes: [{ id: 'c1', name: 'Period 2', students: ['Maya R', 'Leo C', 'Ada O', 'Sam N'], absent: [] }],
    screens: [{ id: 's1', name: 'Screen 1', bg: 'mist', widgets }],
  }, extra || {});
}
function widget(type, data, at) {
  const [x, y, w, h] = at || [0.02, 0.03, 0.4, 0.6];
  return { id: type + '1', type, x, y, w, h, z: 1, data };
}

// + opens the New screen menu; pick a starting point (Default layout unless given).
async function addScreen(page, choice) {
  await page.click('.tab.add');
  await page.click('.pop .opt >> text=' + (choice || 'Default layout'));
}

module.exports = { APP, KEY, openApp, settle, stored, board, widget, addScreen };
