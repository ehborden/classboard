# Classboard

A classroom display for the projector, built to support executive functioning and ADHD. You build screens out of widgets (agenda, timer, clock, task steps, seating chart, text, images, a name picker, music), then present them full screen. Each teacher's setup is their own: nothing is shared between computers or people.

**Live site:** https://ehborden.github.io/classboard/

## What this is

`index.html` is the whole app. There is no server, no account, and no build step. Open the live site, or download `index.html` and double-click it.

Everything you make (screens, widgets, class lists, seating charts, settings) is saved in your browser's storage under the key `classboard.v1`, not in the file. That one fact explains the rest of this page.

## Where your boards are saved

- **One browser on one computer.** Boards made in Chrome on your classroom computer stay there. A different computer, a different browser, or a private window starts fresh.
- **The live site and a downloaded file are separate places.** Boards made at the github.io link do not show up in a double-clicked copy, and the reverse. Pick one and stick with it.
- **Clearing browsing data deletes your boards.** Clearing "cookies and site data" in Chrome wipes them. So does using a private window, and so might a school computer that resets on logout.

## Backup and Import

Gear menu, then **Backup**.

- **Download backup** saves everything to one file, including images. Keep it somewhere safe, like Google Drive.
- **Import backup** replaces everything in this browser with a backup file. It is not a merge. A backup of what is there now downloads first, automatically, so an import can always be reversed.
- After the first week, if your last backup is more than two weeks old, the app reminds you once per visit.

To move to a new computer: Download backup on the old one, then Import backup on the new one.

## Undo

**Undo** in the top bar (or Cmd+Z outside a text field) steps back through up to 40 changes: a removed widget, a deleted class, a cleared seating chart, an import. The history resets when you reload the page. Switching screens is not an undo step.

## Features

- **Screens and widgets.** Drag a widget by its title bar, resize from its corner, minimize it to just its title bar. New screens start with an agenda, a text box, a clock, and a timer. Screen settings has **Use default layout** to rearrange an older screen.
- **Present** goes full screen and hides the controls. Arrow keys switch screens, Esc exits. The bar at the bottom has Prev, Next, Calm, and Exit.
- **Agenda.** No times. The first unchecked item is the current one: bold and teal, with everything else in gray. Drag the handle to reorder. In Present mode it shows the current item and the next two.
- **Timer.** A dial that empties as time runs out. Silent unless you turn on **Bell**. Presets of 1, 3, 5, and 10 minutes, or type a time like `7` or `2:30`.
- **Float clock.** A small always-on-top window with the clock and timer, so they stay visible over PowerPoint. Flip between the full timer and a small clock. Works in Chrome and Edge, not Safari.
- **Task steps.** Up to five steps. The current step is bold and teal.
- **Seating chart.** Step 1, set up the room: start from rows of desks or table groups, then move pieces to match. Step 2, seat students by dragging names or clicking a name and then a chair. Each class keeps its own seats in the same room.
- **Names and groups.** Pick a name, make partners, or make groups, skipping absent students.
- **Classes.** Add students one at a time, paste a list, or **Import from a file or photo**: CSV, Excel, PDF, or a picture or screenshot of a roster. Photos and scanned PDFs are read inside your browser, so names never leave the computer. Everything goes to a review box first, where you choose full names, first name and last initial, or first names only.
- **Calm mode** turns off sound, motion, and music, and always keeps a clock on screen.
- **Board name.** Click "Classboard" in the top left to rename it, for example "Room 204."

## Design rules

These come from research on classroom displays and executive functioning, and the app follows them by default:

- One font, Source Sans 3, at weights 500 to 700 only.
- Text and accent colors meet 7:1 contrast, because projectors wash colors out.
- Color is never the only signal; it is paired with a change in weight.
- No red. No flashing. The timer is silent by default.
- In Present mode, text is sized for a back row up to 20 feet away.
- No em dashes in any text in the app.

## Updating the app

The live site updates on its own when changes are pushed to `main`. Do a hard refresh (Cmd+Shift+R) to see the newest version. Your boards are untouched by updates, since they live in the browser, not the file.

## Running the tests

The tests are for whoever is changing the code. They are not needed to use the app. They need Node.js.

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm test
```

The tests open `index.html` straight from disk and cover backup and import, Undo, the agenda, timer, task steps, seating chart, calm mode, and importing students from every supported file type. They never touch your real boards: each test starts in an empty browser. The import helpers that the app normally loads from the internet are served from `node_modules` instead, so the tests run offline.

## Known limits

- **No sync between computers, on purpose.** Each person's setup is their own. Use Backup to move it.
- **Images take space.** Browsers allow about 5 MB per site. A few large images can fill it, and then the app warns that it cannot save. Remove large images to make room.
- **Importing from a photo or PDF** needs an internet connection the first time, to load the text reader. Photos of handwriting will not read well. Always check the review box before adding names.
- **Float clock over a fullscreen PowerPoint on a Mac** has not been tested yet.
