import { Database } from "bun:sqlite";
import { shortcuts } from "./shortcuts";

const db = new Database("readline-trainer.db", { create: true });
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS shortcuts (
    id TEXT PRIMARY KEY,
    key_combo TEXT NOT NULL,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    next_review_at TEXT NOT NULL DEFAULT '2000-01-01T00:00:00.000Z',
    total_attempts INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    session_attempts INTEGER NOT NULL DEFAULT 0,
    session_correct INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    total_cards INTEGER NOT NULL DEFAULT 0,
    correct_cards INTEGER NOT NULL DEFAULT 0
  )
`);

// Seed shortcuts if empty
const count = db.query("SELECT COUNT(*) as c FROM shortcuts").get() as { c: number };
if (count.c === 0) {
  const insert = db.prepare(
    "INSERT INTO shortcuts (id, key_combo, action, category) VALUES (?, ?, ?, ?)"
  );
  for (const s of shortcuts) {
    insert.run(s.id, s.keyCombo, s.action, s.category);
  }
}

export interface ShortcutRow {
  id: string;
  key_combo: string;
  action: string;
  category: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  total_attempts: number;
  total_correct: number;
  current_streak: number;
  best_streak: number;
  session_attempts: number;
  session_correct: number;
}

export function getAllShortcuts(): ShortcutRow[] {
  return db.query("SELECT * FROM shortcuts").all() as ShortcutRow[];
}

export function getShortcut(id: string): ShortcutRow | null {
  return (db.query("SELECT * FROM shortcuts WHERE id = ?").get(id) as ShortcutRow) ?? null;
}

export function updateSrsFields(
  id: string,
  easeFactor: number,
  intervalDays: number,
  repetitions: number,
  nextReviewAt: string
) {
  db.query(
    `UPDATE shortcuts SET ease_factor = ?, interval_days = ?, repetitions = ?, next_review_at = ? WHERE id = ?`
  ).run(easeFactor, intervalDays, repetitions, nextReviewAt, id);
}

export function recordAttempt(id: string, correct: boolean) {
  if (correct) {
    db.query(
      `UPDATE shortcuts SET
        total_attempts = total_attempts + 1,
        total_correct = total_correct + 1,
        current_streak = current_streak + 1,
        best_streak = MAX(best_streak, current_streak + 1),
        session_attempts = session_attempts + 1,
        session_correct = session_correct + 1
      WHERE id = ?`
    ).run(id);
  } else {
    db.query(
      `UPDATE shortcuts SET
        total_attempts = total_attempts + 1,
        current_streak = 0,
        session_attempts = session_attempts + 1
      WHERE id = ?`
    ).run(id);
  }
}

export function resetSessionCounters() {
  db.query("UPDATE shortcuts SET session_attempts = 0, session_correct = 0").run();
}

export function startSession(): number {
  resetSessionCounters();
  const result = db
    .query("INSERT INTO sessions (started_at) VALUES (?) RETURNING id")
    .get(new Date().toISOString()) as { id: number };
  return result.id;
}

export function endSession(sessionId: number): { totalCards: number; correctCards: number } {
  const rows = getAllShortcuts();
  const totalCards = rows.reduce((sum, r) => sum + r.session_attempts, 0);
  const correctCards = rows.reduce((sum, r) => sum + r.session_correct, 0);

  db.query("UPDATE sessions SET ended_at = ?, total_cards = ?, correct_cards = ? WHERE id = ?").run(
    new Date().toISOString(),
    totalCards,
    correctCards,
    sessionId
  );

  return { totalCards, correctCards };
}
