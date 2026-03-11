# Readline Trainer

Practice readline keyboard shortcuts (Ctrl-A, Ctrl-E, Alt-F, etc.) through spaced repetition quizzes. A personal browser app that shows a simulated terminal line and asks you to press the correct shortcut to achieve a goal like "delete the next word." Tracks which shortcuts you're weakest at using SM-2 spaced repetition.

## Run

Requires [Bun](https://bun.sh).

```
bun run dev
```

Open http://localhost:3000.

## Shortcuts Covered

**Movement:** Ctrl-B/F (char), Alt-B/F (word), Ctrl-A (start), Ctrl-E (end)

**Deletion:** Ctrl-D/H (char), Alt-D (word fwd), Ctrl-W (word back), Ctrl-K (kill to end), Ctrl-U (kill to start)

## How It Works

- Quiz shows a terminal line with cursor and asks you to press the right shortcut
- Ctrl-W falls back to multiple choice (it closes the browser tab)
- SM-2 spaced repetition surfaces weak shortcuts more often
- Stats persist in SQLite across sessions
- Tutorial mode lets you practice freely with a sandbox input
