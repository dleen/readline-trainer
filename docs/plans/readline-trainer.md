# Readline Shortcut Trainer

## Context

You know the readline shortcuts (Ctrl-A, Ctrl-E, etc.) but want to build muscle memory through spaced repetition practice. This is a personal browser app that quizzes you by showing a simulated terminal line with a cursor, then asking you to press the correct shortcut to achieve a goal (e.g., "delete the next word"). It tracks which shortcuts you're weakest at using SM-2 spaced repetition.

## Project Location

`/Users/dleen/src/tries/2026-03-10-readline-trainer/`

## File Structure (9 files)

```
readline-trainer/
  package.json
  tsconfig.json
  .gitignore
  server.ts          # Bun HTTP server: static files + REST API
  db.ts              # bun:sqlite schema, seed, queries
  srs.ts             # SM-2 spaced repetition algorithm
  readline.ts        # Simulate readline operations (compute expected results)
  shortcuts.ts       # 12 shortcut definitions
  quiz.ts            # Procedural quiz scenario generation
  public/
    index.html       # Single-page app shell
    style.css        # Dark terminal aesthetic
    app.js           # Client: keyboard capture, quiz UI, fetch calls
```

No build step. Bun serves TS directly for the server; client is plain JS/CSS/HTML.

## The 12 Shortcuts

| ID | Combo | Action | Category |
|----|-------|--------|----------|
| ctrl-b | Ctrl-B | Back one char | movement |
| ctrl-f | Ctrl-F | Forward one char | movement |
| alt-b | Alt-B | Back one word | movement |
| alt-f | Alt-F | Forward one word | movement |
| ctrl-a | Ctrl-A | Start of line | movement |
| ctrl-e | Ctrl-E | End of line | movement |
| ctrl-d | Ctrl-D | Delete char forward | deletion |
| ctrl-h | Ctrl-H | Delete char backward | deletion |
| alt-d | Alt-D | Delete word forward | deletion |
| ctrl-w | Ctrl-W | Delete word backward | deletion |
| ctrl-k | Ctrl-K | Kill to end of line | deletion |
| ctrl-u | Ctrl-U | Kill to start of line | deletion |

## Database Schema (bun:sqlite)

**shortcuts table** — card definitions + SRS state + stats (combined for simplicity):
- `id`, `key_combo`, `action`, `category`
- SM-2: `ease_factor` (default 2.5), `interval_days`, `repetitions`, `next_review_at`
- Stats: `total_attempts`, `total_correct`, `current_streak`, `best_streak`
- Session: `session_attempts`, `session_correct` (reset per session)

**sessions table** — session history for summary:
- `id`, `started_at`, `ended_at`, `total_cards`, `correct_cards`

Seeded with all 12 shortcuts on first run.

## Server API (server.ts)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serve index.html |
| GET | `/api/next` | Next quiz card (SRS-weighted selection) |
| POST | `/api/answer` | Submit `{ shortcutId, correct }`, update SRS |
| GET | `/api/stats` | All shortcut stats for summary |
| POST | `/api/session/start` | Begin session, reset session counters |
| POST | `/api/session/end` | End session, return summary |

## Keyboard Capture Strategy

Most shortcuts capturable via `keydown` + `e.preventDefault()` in capture phase. Key issues:

- **Ctrl-W**: Uncapturable (closes tab). Use **click-based multiple choice** as fallback — show 4 options, user clicks the correct one.
- **Alt key on macOS**: Option produces special chars. Use `e.code` (e.g. `KeyB`) instead of `e.key` when `e.altKey` is true.
- **Ctrl vs Cmd**: Match on `ctrlKey` only (not `metaKey`) since we're training terminal shortcuts. Show a note: "Use Ctrl, not Cmd."
- For any shortcut where `preventDefault` fails (detected at runtime), fall back to multiple choice.

## Quiz Flow

1. **Fetch next card** from `/api/next` (SRS-weighted)
2. **Generate scenario**: pick random terminal-like text from a pool of ~30 commands, place cursor at a meaningful position for the shortcut being quizzed
3. **Display**: simulated terminal line with block cursor, show category + action description
4. **One attempt**: user presses shortcut (or clicks for fallback). Show before/after terminal state.
5. **Feedback**: green flash + animation (correct) or red flash + show correct answer (wrong)
6. **POST result**, fetch next card
7. **Session ends**: after 20 cards, or user clicks "End Session", or all due cards reviewed

## SRS Algorithm (Modified SM-2)

**Cross-session** (standard SM-2):
- Correct: interval grows (1d -> 6d -> interval * ease_factor), ease may increase +0.1
- Wrong: repetitions reset to 0, interval to 0, ease -= 0.2 (min 1.3)

**In-session** card selection priority:
1. Failed in this session, not yet re-answered correctly (immediate re-drill)
2. Past `next_review_at` (due for review)
3. Never seen, max 3 new cards per session
4. Low ease_factor cards for extra practice

Weighted random within tiers by `1/ease_factor`. Never show same card twice in a row.

## UI Design

Dark terminal aesthetic (Catppuccin-inspired colors). Three areas:
- **Header**: title, session progress (14/20), accuracy %
- **Terminal**: styled div with monospace text + block cursor, shows before state, animates to after state
- **Controls**: prompt text, feedback area, fallback buttons when needed
- **Stats bar**: streak, per-card accuracy

## Implementation Sequence

### Phase 1: Core backend
1. `shortcuts.ts` — 12 shortcut definitions with key matching metadata
2. `readline.ts` — implement all 12 operations (word boundary = `[a-zA-Z0-9_]`)
3. `srs.ts` — SM-2 + in-session scheduling
4. `db.ts` — schema, seed, CRUD queries

### Phase 2: Server + quiz logic
5. `quiz.ts` — scenario generation (text pool + cursor placement)
6. `server.ts` — Bun.serve() with routes, static file serving

### Phase 3: Frontend
7. `public/index.html` — app shell
8. `public/style.css` — terminal styling
9. `public/app.js` — keyboard capture, quiz UI, API calls

### Phase 4: Config + polish
10. `package.json` with `bun run dev` script
11. `.gitignore` (*.db, node_modules/)
12. `tsconfig.json`

## Verification

1. `bun run server.ts` — server starts on localhost:3000
2. Open in browser, verify all 12 shortcuts display correctly
3. Test keyboard capture for each shortcut (note which fall back to click mode)
4. Complete a full 20-card session, verify SRS intervals update
5. Close and reopen — verify stats persist in SQLite
6. Start new session — verify due cards surface first, weak cards appear more often
