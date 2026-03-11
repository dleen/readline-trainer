export interface LineState {
  text: string;
  cursor: number;
}

const WORD_CHAR = /[a-zA-Z0-9_]/;

function isWordChar(ch: string): boolean {
  return WORD_CHAR.test(ch);
}

/** Find the start of the previous word (skip non-word chars, then skip word chars). */
function wordBoundaryBack(text: string, cursor: number): number {
  let i = cursor - 1;
  // Skip non-word characters
  while (i >= 0 && !isWordChar(text[i])) i--;
  // Skip word characters
  while (i >= 0 && isWordChar(text[i])) i--;
  return i + 1;
}

/** Find the end of the next word (skip non-word chars, then skip word chars). */
function wordBoundaryForward(text: string, cursor: number): number {
  let i = cursor;
  // Skip non-word characters
  while (i < text.length && !isWordChar(text[i])) i++;
  // Skip word characters
  while (i < text.length && isWordChar(text[i])) i++;
  return i;
}

export const operations: Record<string, (state: LineState) => LineState> = {
  "ctrl-b": ({ text, cursor }) => ({
    text,
    cursor: Math.max(0, cursor - 1),
  }),

  "ctrl-f": ({ text, cursor }) => ({
    text,
    cursor: Math.min(text.length, cursor + 1),
  }),

  "alt-b": ({ text, cursor }) => ({
    text,
    cursor: wordBoundaryBack(text, cursor),
  }),

  "alt-f": ({ text, cursor }) => ({
    text,
    cursor: wordBoundaryForward(text, cursor),
  }),

  "ctrl-a": ({ text }) => ({
    text,
    cursor: 0,
  }),

  "ctrl-e": ({ text }) => ({
    text,
    cursor: text.length,
  }),

  "ctrl-d": ({ text, cursor }) => ({
    text: text.slice(0, cursor) + text.slice(cursor + 1),
    cursor,
  }),

  "ctrl-h": ({ text, cursor }) => ({
    text: text.slice(0, Math.max(0, cursor - 1)) + text.slice(cursor),
    cursor: Math.max(0, cursor - 1),
  }),

  "alt-d": ({ text, cursor }) => {
    const end = wordBoundaryForward(text, cursor);
    return {
      text: text.slice(0, cursor) + text.slice(end),
      cursor,
    };
  },

  "ctrl-w": ({ text, cursor }) => {
    const start = wordBoundaryBack(text, cursor);
    return {
      text: text.slice(0, start) + text.slice(cursor),
      cursor: start,
    };
  },

  "ctrl-k": ({ text, cursor }) => ({
    text: text.slice(0, cursor),
    cursor,
  }),

  "ctrl-u": ({ text, cursor }) => ({
    text: text.slice(cursor),
    cursor: 0,
  }),
};

export function applyOperation(shortcutId: string, state: LineState): LineState {
  const op = operations[shortcutId];
  if (!op) throw new Error(`Unknown shortcut: ${shortcutId}`);
  return op(state);
}
