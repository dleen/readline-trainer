import {
  getAllShortcuts,
  getShortcut,
  updateSrsFields,
  recordAttempt,
  startSession,
  endSession,
} from "./db";
import { updateSrs, selectNextCard, type CardForSelection, type SessionState } from "./srs";
import { generateScenario } from "./quiz";
import { shortcuts as shortcutDefs } from "./shortcuts";

let currentSessionId: number | null = null;
const sessionState: SessionState = { newCardsIntroduced: 0, lastCardId: null };

// Track which cards failed in session and haven't been re-answered correctly
const failedInSession = new Set<string>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  // Static files
  if (pathname === "/") {
    return new Response(Bun.file("public/index.html"));
  }
  if (pathname.startsWith("/public/") || pathname.endsWith(".css") || pathname.endsWith(".js")) {
    const filePath = pathname.startsWith("/public/") ? pathname.slice(1) : `public${pathname}`;
    const file = Bun.file(filePath);
    if (await file.exists()) return new Response(file);
    return new Response("Not found", { status: 404 });
  }

  // API routes
  if (pathname === "/api/next" && req.method === "GET") {
    const rows = getAllShortcuts();
    const cards: CardForSelection[] = rows.map((r) => ({
      id: r.id,
      easeFactor: r.ease_factor,
      intervalDays: r.interval_days,
      nextReviewAt: r.next_review_at,
      sessionAttempts: r.session_attempts,
      sessionCorrect: r.session_correct,
      failedInSession: failedInSession.has(r.id),
    }));

    const nextId = selectNextCard(cards, sessionState);
    if (!nextId) return json({ done: true });

    const row = getShortcut(nextId);
    if (!row) return json({ error: "Card not found" }, 500);

    // Track new card introductions
    if (row.session_attempts === 0 && row.interval_days === 0) {
      sessionState.newCardsIntroduced++;
    }

    const scenario = generateScenario(nextId);
    sessionState.lastCardId = nextId;

    const def = shortcutDefs.find((s) => s.id === nextId);

    return json({
      done: false,
      shortcutId: nextId,
      keyCombo: row.key_combo,
      action: row.action,
      category: row.category,
      needsFallback: def?.needsFallback ?? false,
      prompt: scenario.prompt,
      before: scenario.before,
      after: scenario.after,
      // Include other choices for multiple-choice fallback
      choices: shortcutDefs
        .filter((s) => s.category === row.category)
        .map((s) => ({ id: s.id, keyCombo: s.keyCombo, action: s.action })),
    });
  }

  if (pathname === "/api/answer" && req.method === "POST") {
    const body = (await req.json()) as { shortcutId: string; correct: boolean };
    const { shortcutId, correct } = body;

    const row = getShortcut(shortcutId);
    if (!row) return json({ error: "Unknown shortcut" }, 400);

    // Update SRS
    const srsUpdate = updateSrs(
      {
        easeFactor: row.ease_factor,
        intervalDays: row.interval_days,
        repetitions: row.repetitions,
        nextReviewAt: row.next_review_at,
      },
      correct
    );
    updateSrsFields(shortcutId, srsUpdate.easeFactor, srsUpdate.intervalDays, srsUpdate.repetitions, srsUpdate.nextReviewAt);

    // Update stats
    recordAttempt(shortcutId, correct);

    // Track session failures
    if (!correct) {
      failedInSession.add(shortcutId);
    } else {
      failedInSession.delete(shortcutId);
    }

    const totalRows = getAllShortcuts();
    const sessionTotal = totalRows.reduce((s, r) => s + r.session_attempts, 0);
    const sessionCorrect = totalRows.reduce((s, r) => s + r.session_correct, 0);

    return json({
      correct,
      sessionTotal,
      sessionCorrect,
      accuracy: sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0,
    });
  }

  if (pathname === "/api/stats" && req.method === "GET") {
    const rows = getAllShortcuts();
    return json(
      rows.map((r) => ({
        id: r.id,
        keyCombo: r.key_combo,
        action: r.action,
        category: r.category,
        easeFactor: r.ease_factor,
        totalAttempts: r.total_attempts,
        totalCorrect: r.total_correct,
        accuracy: r.total_attempts > 0 ? Math.round((r.total_correct / r.total_attempts) * 100) : null,
        currentStreak: r.current_streak,
        bestStreak: r.best_streak,
      }))
    );
  }

  if (pathname === "/api/session/start" && req.method === "POST") {
    currentSessionId = startSession();
    sessionState.newCardsIntroduced = 0;
    sessionState.lastCardId = null;
    failedInSession.clear();
    return json({ sessionId: currentSessionId });
  }

  if (pathname === "/api/session/end" && req.method === "POST") {
    if (currentSessionId === null) return json({ error: "No active session" }, 400);
    const summary = endSession(currentSessionId);
    currentSessionId = null;
    return json(summary);
  }

  return new Response("Not found", { status: 404 });
}

const server = Bun.serve({
  port: 3000,
  fetch: handleRequest,
});

console.log(`Readline Trainer running at http://localhost:${server.port}`);
