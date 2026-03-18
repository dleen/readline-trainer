/** @type {{ shortcutId: string, keyCombo: string, action: string, category: string, needsFallback: boolean, prompt: string, before: { text: string, cursor: number }, after: { text: string, cursor: number }, choices: { id: string, keyCombo: string, action: string }[] } | null} */
let currentCard = null;
let sessionTotal = 0;
let sessionCorrect = 0;
let waiting = false;
let waitingForNext = false;
const MAX_CARDS = 20;

// DOM refs
const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const endScreen = document.getElementById("end-screen");
const sessionInfo = document.getElementById("session-info");
const progress = document.getElementById("progress");
const accuracy = document.getElementById("accuracy");
const promptText = document.getElementById("prompt-text");
const terminalLine = document.getElementById("terminal-line");
const terminal = document.getElementById("terminal");
const feedback = document.getElementById("feedback");
const choices = document.getElementById("choices");
const categoryBadge = document.getElementById("category-badge");
const shortcutHint = document.getElementById("shortcut-hint");
const endSessionBtn = document.getElementById("end-session-btn");

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

/**
 * Render terminal line with block cursor at given position.
 */
function renderTerminal(text, cursor) {
  let html = "";
  for (let i = 0; i < text.length; i++) {
    if (i === cursor) {
      html += `<span class="cursor-char">${escapeHtml(text[i])}</span>`;
    } else {
      html += escapeHtml(text[i]);
    }
  }
  // If cursor is at end of text, show a block cursor
  if (cursor >= text.length) {
    html += `<span class="cursor-end">&nbsp;</span>`;
  }
  terminalLine.innerHTML = html;
}

function escapeHtml(ch) {
  if (ch === "<") return "&lt;";
  if (ch === ">") return "&gt;";
  if (ch === "&") return "&amp;";
  return ch;
}

function updateProgress() {
  progress.textContent = `${sessionTotal}/${MAX_CARDS}`;
  const pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
  accuracy.textContent = `${pct}%`;
}

async function startSession() {
  await fetch("/api/session/start", { method: "POST" });
  sessionTotal = 0;
  sessionCorrect = 0;
  hide(startScreen);
  hide(endScreen);
  show(quizScreen);
  show(sessionInfo);
  show(endSessionBtn);
  updateProgress();
  await nextCard();
}

async function nextCard() {
  if (sessionTotal >= MAX_CARDS) {
    await endSessionEarly();
    return;
  }

  const res = await fetch("/api/next");
  const data = await res.json();

  if (data.done) {
    await endSessionEarly();
    return;
  }

  currentCard = data;
  waiting = false;
  console.log("[next] card:", data.shortcutId, data.keyCombo, { needsFallback: data.needsFallback, before: data.before });

  // Display
  promptText.textContent = data.prompt;
  renderTerminal(data.before.text, data.before.cursor);
  categoryBadge.textContent = data.category;
  hide(feedback);
  hide(shortcutHint);

  // Show multiple choice if needed
  if (data.needsFallback) {
    showChoices(data.choices, data.shortcutId);
  } else {
    hide(choices);
  }

  hide(document.getElementById("next-prompt"));
  waitingForNext = false;
}

function advanceToNext() {
  waitingForNext = false;
  hide(document.getElementById("next-prompt"));
  nextCard();
}

function showChoices(choiceList, correctId) {
  choices.innerHTML = "";
  // Shuffle choices
  const shuffled = [...choiceList].sort(() => Math.random() - 0.5);
  for (const c of shuffled) {
    const btn = document.createElement("button");
    btn.innerHTML = `<span class="combo">${c.keyCombo}</span>${c.action}`;
    btn.addEventListener("click", () => handleAnswer(c.id === correctId));
    choices.appendChild(btn);
  }
  show(choices);
}

/**
 * Look up what a pressed key combo does, if it matches a known shortcut.
 */
function describePressed(ctrlKey, altKey, code) {
  for (const [id, m] of Object.entries(SHORTCUT_MATCHES)) {
    if (m.ctrlKey === ctrlKey && m.altKey === altKey && m.code === code) {
      const parts = id.split("-");
      const combo = (parts[0] === "ctrl" ? "Ctrl-" : "Alt-") + parts[1].toUpperCase();
      // Find action from shortcut matches - look up in choices or hardcode
      const actions = {
        "ctrl-b": "Back one char", "ctrl-f": "Forward one char",
        "alt-b": "Back one word", "alt-f": "Forward one word",
        "ctrl-a": "Start of line", "ctrl-e": "End of line",
        "ctrl-d": "Delete char forward", "ctrl-h": "Delete char backward",
        "alt-d": "Delete word forward", "ctrl-w": "Delete word backward",
        "ctrl-k": "Kill to end of line", "ctrl-u": "Kill to start of line",
      };
      return `${combo} (${actions[id]})`;
    }
  }
  const mod = ctrlKey ? "Ctrl-" : altKey ? "Alt-" : "";
  const key = code.replace("Key", "");
  return `${mod}${key} (not a readline shortcut)`;
}

async function handleAnswer(correct, pressedKeys) {
  if (!currentCard || waiting) return;
  waiting = true;

  // Flash terminal
  terminal.classList.remove("flash-correct", "flash-wrong");
  // Force reflow for animation restart
  void terminal.offsetWidth;
  terminal.classList.add(correct ? "flash-correct" : "flash-wrong");

  // Show after state
  renderTerminal(currentCard.after.text, currentCard.after.cursor);

  // Show feedback
  feedback.className = correct ? "correct" : "wrong";
  if (correct) {
    feedback.textContent = "Correct!";
  } else {
    const youPressed = pressedKeys ? describePressed(pressedKeys.ctrlKey, pressedKeys.altKey, pressedKeys.code) : "wrong choice";
    feedback.textContent = `You pressed ${youPressed}`;
    show(shortcutHint);
    shortcutHint.textContent = `Answer: ${currentCard.keyCombo} (${currentCard.action})`;
  }
  show(feedback);
  hide(choices);

  // Post result
  const res = await fetch("/api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shortcutId: currentCard.shortcutId, correct }),
  });
  const result = await res.json();

  sessionTotal = result.sessionTotal;
  sessionCorrect = result.sessionCorrect;
  updateProgress();

  // Wait for user to continue
  show(document.getElementById("next-prompt"));
  waitingForNext = true;
}

// Keyboard capture
document.addEventListener(
  "keydown",
  (e) => {
    // Advance to next card on Enter
    if (waitingForNext && e.key === "Enter") {
      e.preventDefault();
      advanceToNext();
      return;
    }
    if (!currentCard || waiting) {
      console.log("[keydown] ignored: no card or waiting", { currentCard: !!currentCard, waiting, waitingForNext });
      return;
    }
    // Ignore modifier-only keypresses (Ctrl, Alt, Shift, Meta by themselves)
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
    // Only capture Ctrl/Alt combos
    if (!e.ctrlKey && !e.altKey) {
      console.log("[keydown] ignored: no modifier", { key: e.key, code: e.code });
      return;
    }

    const ctrlKey = e.ctrlKey && !e.metaKey;
    const altKey = e.altKey;
    const code = e.code;
    const expectedId = currentCard.shortcutId;

    console.log("[keydown] captured", { ctrlKey, altKey, code, expectedId, needsFallback: currentCard.needsFallback });

    e.preventDefault();
    e.stopPropagation();

    // For fallback cards (Ctrl-W), still check if the pressed keys match.
    // preventDefault() stops the browser action, so accept correct presses.
    if (currentCard.needsFallback) {
      const pressedMatchesFallback = checkMatch(ctrlKey, altKey, code, currentCard.shortcutId);
      console.log("[keydown] fallback card — match:", pressedMatchesFallback);
      handleAnswer(pressedMatchesFallback, { ctrlKey, altKey, code });
      return;
    }

    const pressedMatchesExpected = checkMatch(ctrlKey, altKey, code, expectedId);
    console.log("[keydown] match result:", pressedMatchesExpected);

    handleAnswer(pressedMatchesExpected, { ctrlKey, altKey, code });
  },
  true // capture phase
);

/**
 * Check if pressed keys match the expected shortcut.
 */
function checkMatch(ctrlKey, altKey, code, expectedId) {
  // Build the expected match from shortcut ID
  const expected = SHORTCUT_MATCHES[expectedId];
  if (!expected) return false;
  return expected.ctrlKey === ctrlKey && expected.altKey === altKey && expected.code === code;
}

// Shortcut match data (mirrors shortcuts.ts)
const SHORTCUT_MATCHES = {
  "ctrl-b": { ctrlKey: true, altKey: false, code: "KeyB" },
  "ctrl-f": { ctrlKey: true, altKey: false, code: "KeyF" },
  "alt-b":  { ctrlKey: false, altKey: true, code: "KeyB" },
  "alt-f":  { ctrlKey: false, altKey: true, code: "KeyF" },
  "ctrl-a": { ctrlKey: true, altKey: false, code: "KeyA" },
  "ctrl-e": { ctrlKey: true, altKey: false, code: "KeyE" },
  "ctrl-d": { ctrlKey: true, altKey: false, code: "KeyD" },
  "ctrl-h": { ctrlKey: true, altKey: false, code: "KeyH" },
  "alt-d":  { ctrlKey: false, altKey: true, code: "KeyD" },
  "ctrl-w": { ctrlKey: true, altKey: false, code: "KeyW" },
  "ctrl-k": { ctrlKey: true, altKey: false, code: "KeyK" },
  "ctrl-u": { ctrlKey: true, altKey: false, code: "KeyU" },
};

async function endSessionEarly() {
  const res = await fetch("/api/session/end", { method: "POST" });
  const summary = await res.json();

  hide(quizScreen);
  hide(endSessionBtn);
  show(endScreen);

  const pct = summary.totalCards > 0 ? Math.round((summary.correctCards / summary.totalCards) * 100) : 0;
  document.getElementById("summary").textContent =
    `${summary.correctCards}/${summary.totalCards} correct (${pct}%)`;

  // Fetch and display stats
  const statsRes = await fetch("/api/stats");
  const stats = await statsRes.json();

  const grid = document.getElementById("stats-grid");
  grid.innerHTML = stats
    .map((s) => {
      let accClass = "none";
      let accText = "—";
      if (s.accuracy !== null) {
        accText = `${s.accuracy}%`;
        accClass = s.accuracy >= 80 ? "good" : s.accuracy >= 50 ? "ok" : "bad";
      }
      return `<div class="stat-card">
        <span class="combo">${s.keyCombo}</span> ${s.action}
        <span class="stat-acc ${accClass}">${accText}</span>
      </div>`;
    })
    .join("");
}

const tutorialScreen = document.getElementById("tutorial-screen");

const sandboxInput = document.getElementById("sandbox-input");
const sandboxStatus = document.getElementById("sandbox-status");
let sandboxTimeout = null;

function showTutorial() {
  hide(startScreen);
  show(tutorialScreen);
  sandboxInput.focus();
}

function hideTutorial() {
  hide(tutorialScreen);
  show(startScreen);
}

// Detect shortcut usage in the sandbox input and show what was used
sandboxInput.addEventListener("keydown", (e) => {
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
  if (!e.ctrlKey && !e.altKey) return;

  const ctrlKey = e.ctrlKey && !e.metaKey;
  const altKey = e.altKey;
  const code = e.code;

  for (const [id, m] of Object.entries(SHORTCUT_MATCHES)) {
    if (m.ctrlKey === ctrlKey && m.altKey === altKey && m.code === code) {
      const ACTIONS = {
        "ctrl-b": "Back one char", "ctrl-f": "Forward one char",
        "alt-b": "Back one word", "alt-f": "Forward one word",
        "ctrl-a": "Start of line", "ctrl-e": "End of line",
        "ctrl-d": "Delete char forward", "ctrl-h": "Delete char backward",
        "alt-d": "Delete word forward", "ctrl-w": "Delete word backward",
        "ctrl-k": "Kill to end of line", "ctrl-u": "Kill to start of line",
      };
      sandboxStatus.textContent = `${id.replace("ctrl-", "Ctrl-").replace("alt-", "Alt-").replace(/-(\w)/, (_, c) => "-" + c.toUpperCase())} — ${ACTIONS[id]}`;
      clearTimeout(sandboxTimeout);
      sandboxTimeout = setTimeout(() => { sandboxStatus.textContent = ""; }, 3000);
      return;
    }
  }
});

// Make functions available to onclick handlers
window.startSession = startSession;
window.endSessionEarly = endSessionEarly;
window.showTutorial = showTutorial;
window.hideTutorial = hideTutorial;
window.advanceToNext = advanceToNext;
