# Soviet Spinners

![Soviet Spinners Logo](./src/Soviet%20Spinners%20Logo.png)

**Hot Takes Night — multi-slot randomizer & reveal console**

A client-only host dashboard for running game-night picks: dynamic slot pools, CSV import, local persistence, and a Soviet-industrial casino aesthetic. Built for desktop (1440px+), no backend required.

**Repository:** [github.com/official-mitchell/Soviet-Spinners](https://github.com/official-mitchell/Soviet-Spinners)

---

## Features (current)

| Area | Status |
|------|--------|
| Slot CRUD (add / rename / reorder / delete with confirmation) | Done |
| Per-slot option editing (add, edit, reorder, highlight) | Done |
| CSV import per slot (dedupe, malformed-row summary) | Done |
| Session persistence (`localStorage`, normalized on load) | Done |
| Spin mechanics, freeze/unfreeze, round history UI | Planned |
| Full visual design system & reveal gate (Deck slot) | Planned |

---

## Quick start

**Requirements:** Node.js 18+ (optional — only needed for tests and the dev server)

```bash
git clone https://github.com/official-mitchell/Soviet-Spinners.git
cd Soviet-Spinners
npm start
```

Open the URL shown in the terminal (typically `http://localhost:3000`).

Run the test suite:

```bash
npm test
```

No environment variables or API keys are required.

---

## Project structure

```text
index.html          Host console entry point
css/                Design tokens and layout
src/data/           Session store, CSV import, localStorage
src/ui/             Render layer and event wiring
tests/              Node native unit & scenario tests
src/Soviet Spinners Logo.png   Brand mark (see above)
```

Local planning docs and mock assets live in `instructions/` (gitignored).

---

## Tech stack

- Vanilla HTML / CSS / JavaScript (ES modules)
- `localStorage` for session state
- Node built-in test runner (`node --test`)

---

## License

[MIT](./LICENSE) — Copyright (c) 2026 Mitchell Opatowsky

---

## Changelog

- **2026-08-05:** Initial README; documents §1–§3 implementation (data layer, slot management UI, CSV import).
