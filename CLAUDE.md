# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Rules from the owner

- **Keep it one HTML file with no build step.** All markup, CSS, and JavaScript live in `index.html`. Libraries for importing and saving (SheetJS, pdf.js, Tesseract.js, html2canvas, jsPDF) load lazily from cdnjs or jsdelivr at pinned versions; never bundle them.
- **Never change the localStorage key `classboard.v1`.** Add new fields to the saved state instead, with defaults filled in by `normalize()`. Kept PDFs are the one exception to localStorage: they live in IndexedDB (`classboard-files`, see `FILES`) and the widget saves only their id.
- **No em dashes anywhere in UI text.** Use hyphens or rewrite the sentence.
- **No sync between computers.** Each teacher's setup is meant to be personal. Backup and Import are the only way data moves.
- Follow the design rules in README.md: one font (Source Sans 3, weights 500 to 700), 7:1 contrast, never color alone, no red, no flashing, silent timer by default.
- Push every change to both the working branch and `main`. `main` is what GitHub Pages serves.

## Commands

```bash
npm install
npx playwright install chromium   # first time only
npm test                          # full suite
npx playwright test tests/seating.spec.js
npx playwright test -g "agenda"
```

Grep `index.html` for an em dash before committing; the count must be 0.

## Architecture

`index.html` is organized into banner-commented sections: `/* ---------- Name ---------- */`. Grep for these to navigate: State and saving, Undo, Board, one section per widget (Clock, Timer, Text, Image, Music, Agenda, Task steps, Seating chart, Names, partners, groups), Reading names from lists..., Classes dialog, Popovers, Settings menu, Calm mode, Board name, Backup, Floating clock and timer, Screens, Present mode, Toolbar wiring.

**State.** One object `S` holds everything: `screens` (each with `widgets`), `classes`, `active` screen id, and settings (`title`, `calm`, `main`, `accent`, `floatMode`, `lastBackup`, `since`). `save()` marks the state dirty and debounces a write to localStorage by 300 ms; `flush()` writes immediately. `pagehide` saves only when dirty, and a `storage` listener adopts another tab's newer save, so two tabs cannot overwrite each other with stale copies. Every load, import, and other-tab update runs through `normalize()`, which fills any missing widget field from `TYPES[type].data()`.

**Widgets.** `TYPES` maps a type to its label, description, default size and data, and a `build(w, body, tools, el)` function. A widget's settings live in `w.data` and are saved with the board. Anything per-session (a running timer) lives outside `S`, for example `RT` for timers. `renderBoard()` rebuilds every widget on the current screen; widgets register per-tick updates in `ticks` and class-list listeners in `classHooks`. To add a widget: add it to `TYPES`, add an icon to `ICONS`, and place it in `MENU`.

**Colors.** `S.main` and `S.accent` pick from `MAINS` and `ACCENTS` and are applied by `applyLook()` as `data-main` and `data-accent` on `<html>`. The color values live in the CSS tokens at the top of `index.html`, one block per main color for light and for dark, and one per accent. Both keys are in `NO_UNDO`. Add a new color by adding a CSS block and a list entry, and check 7:1 text contrast against the panel, board, and soft tints.

**Timers** finish in `checkTimers()`, which runs every half second for every running timer in `RT`, on screen or not, and rings the bell if it is on.

**Robustness.** Each widget build is wrapped in try/catch, so a broken widget shows a message instead of blanking the screen. Text box HTML goes through `cleanHTML()` (simple tags only, no attributes) because it can come from backups and templates. Widgets that hold resources (the camera, PDF documents) register a stop function in `cleanups`, which `renderBoard()` runs first.

**Undo.** `flush()` calls `record()`, which stores a JSON snapshot of `S` whenever it changed. Long `data:` image strings are swapped for ids held once in `IMG`, so snapshots stay small. Consecutive typing in the same field updates one step instead of adding one per pause. Keys in `NO_UNDO` (`active`, `floatMode`, `lastBackup`, `since`) are left out, so switching screens is not an undo step. `undo()` restores the previous snapshot and re-renders.

**Pen marks.** The board pen (`pen`, `setPen`) is never saved. PDF marks are stored per page as strokes in `w.data.pdf.marks`, only when the teacher clicks Keep; until then they live in `PDFMEM`. Both draw through `drawStrokes`, with points stored as fractions of the drawing area. `savePdf()` renders the board with html2canvas, lays the pen canvas over it, and writes a one-page PDF with jsPDF; A board with an iframe (Slides, Word, web page) goes through `grabTab()` instead, which uses `getDisplayMedia` with `preferCurrentTab` and crops to the board; the `capturing` body class hides the buttons meanwhile. `flattenColors()` rewrites `color-mix` colors and inset shadows first, because html2canvas cannot read them.

**Templates.** `S.templates` holds saved screens with their widget contents. `starterTemplates()` builds the built-in starter screens fresh each time the New screen menu opens; they are never stored. The board tint comes from the `--mist` color token, so there is no per-screen background; old saved `bg` fields are ignored. `cloneWidgets` renews widget ids only; ids inside a widget stay, because seat assignments point at chair ids.

**Seating chart.** Furniture (`D.items`, tables and chairs placed by fraction of the canvas) is shared by every class. Assignments are per class: `D.seats[classId] = {chairId: name}`. Two steps: set up room, then seat students.

**Importing names.** `namesFromFile` dispatches by file type: CSV and Excel go to `namesFromRows` (header-aware: First, Last, Preferred, or Name columns); PDFs are read for their text layer, falling back to OCR for scanned pages; images go to OCR. Plain text goes to `namesFromText`, which reads each line with `nameFromLine`. Results always land in an editable review box; `formatNames` handles the full, initial, and first-only formats. Names are matched as plain strings, so renaming a student in a class list drops their seat.

**Backups** include kept PDFs as base64 in `files`. `downloadBackup` copies `S` before reading files, so an import right after cannot change the backup. Files that no widget or template points to are deleted at startup.

**Floating window.** Uses Document Picture-in-Picture (Chrome and Edge only). It reads the most recently started timer and can start or pause it.

## Testing conventions

Tests seed state through `openApp(page, board([...]))` in `tests/helpers.js`, which writes `classboard.v1` before the first load, then drive the real UI. Each test gets a fresh browser context. `serveLibs` answers CDN requests from `node_modules`, so import tests run offline against the same pinned library versions. Name-parsing unit tests go through the read-only `window.classboardTest` hook. Roster fixtures for the import tests are generated at run time into `test-results/`.
