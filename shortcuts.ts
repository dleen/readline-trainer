export interface Shortcut {
  id: string;
  keyCombo: string;
  action: string;
  category: "movement" | "deletion";
  match: {
    ctrlKey: boolean;
    altKey: boolean;
    code: string;
  };
  /** Whether this shortcut needs multiple-choice fallback (e.g. Ctrl-W closes tab) */
  needsFallback: boolean;
}

export const shortcuts: Shortcut[] = [
  {
    id: "ctrl-b",
    keyCombo: "Ctrl-B",
    action: "Back one char",
    category: "movement",
    match: { ctrlKey: true, altKey: false, code: "KeyB" },
    needsFallback: false,
  },
  {
    id: "ctrl-f",
    keyCombo: "Ctrl-F",
    action: "Forward one char",
    category: "movement",
    match: { ctrlKey: true, altKey: false, code: "KeyF" },
    needsFallback: false,
  },
  {
    id: "alt-b",
    keyCombo: "Alt-B",
    action: "Back one word",
    category: "movement",
    match: { ctrlKey: false, altKey: true, code: "KeyB" },
    needsFallback: false,
  },
  {
    id: "alt-f",
    keyCombo: "Alt-F",
    action: "Forward one word",
    category: "movement",
    match: { ctrlKey: false, altKey: true, code: "KeyF" },
    needsFallback: false,
  },
  {
    id: "ctrl-a",
    keyCombo: "Ctrl-A",
    action: "Start of line",
    category: "movement",
    match: { ctrlKey: true, altKey: false, code: "KeyA" },
    needsFallback: false,
  },
  {
    id: "ctrl-e",
    keyCombo: "Ctrl-E",
    action: "End of line",
    category: "movement",
    match: { ctrlKey: true, altKey: false, code: "KeyE" },
    needsFallback: false,
  },
  {
    id: "ctrl-d",
    keyCombo: "Ctrl-D",
    action: "Delete char forward",
    category: "deletion",
    match: { ctrlKey: true, altKey: false, code: "KeyD" },
    needsFallback: false,
  },
  {
    id: "ctrl-h",
    keyCombo: "Ctrl-H",
    action: "Delete char backward",
    category: "deletion",
    match: { ctrlKey: true, altKey: false, code: "KeyH" },
    needsFallback: false,
  },
  {
    id: "alt-d",
    keyCombo: "Alt-D",
    action: "Delete word forward",
    category: "deletion",
    match: { ctrlKey: false, altKey: true, code: "KeyD" },
    needsFallback: false,
  },
  {
    id: "ctrl-w",
    keyCombo: "Ctrl-W",
    action: "Delete word backward",
    category: "deletion",
    match: { ctrlKey: true, altKey: false, code: "KeyW" },
    needsFallback: true,
  },
  {
    id: "ctrl-k",
    keyCombo: "Ctrl-K",
    action: "Kill to end of line",
    category: "deletion",
    match: { ctrlKey: true, altKey: false, code: "KeyK" },
    needsFallback: false,
  },
  {
    id: "ctrl-u",
    keyCombo: "Ctrl-U",
    action: "Kill to start of line",
    category: "deletion",
    match: { ctrlKey: true, altKey: false, code: "KeyU" },
    needsFallback: false,
  },
];

export function findShortcutByKeys(ctrlKey: boolean, altKey: boolean, code: string): Shortcut | undefined {
  return shortcuts.find(
    (s) => s.match.ctrlKey === ctrlKey && s.match.altKey === altKey && s.match.code === code
  );
}

export function getShortcutById(id: string): Shortcut | undefined {
  return shortcuts.find((s) => s.id === id);
}
