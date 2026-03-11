import { type LineState, applyOperation } from "./readline";
import { getShortcutById, type Shortcut } from "./shortcuts";

const COMMAND_POOL = [
  "git commit -m 'initial commit'",
  "docker run --rm -it ubuntu:latest bash",
  "ssh user@remote-server.example.com",
  "curl -sL https://api.example.com/data | jq '.results'",
  "find . -name '*.ts' -exec grep -l 'import' {} +",
  "tar -czf backup.tar.gz /var/log/app/",
  "kubectl get pods --namespace production",
  "npm install --save-dev typescript @types/node",
  "rsync -avz ~/projects/ backup:/mnt/data/",
  "awk '{print $1, $3}' access.log | sort | uniq -c",
  "grep -rn 'TODO' src/ --include='*.ts'",
  "sed -i 's/old_value/new_value/g' config.yaml",
  "python -m pytest tests/ -v --cov=src",
  "chmod 755 deploy.sh && ./deploy.sh staging",
  "cat /etc/hosts | grep localhost",
  "export DATABASE_URL='postgres://localhost:5432/mydb'",
  "ls -la ~/.config/readline-trainer/",
  "mv old_directory/ new_directory/",
  "ping -c 4 google.com",
  "journalctl -u nginx --since '1 hour ago'",
  "openssl req -new -x509 -days 365 -out cert.pem",
  "wc -l src/**/*.ts",
  "diff --color old_file.txt new_file.txt",
  "ps aux | grep node | grep -v grep",
  "ln -s /usr/local/bin/python3 /usr/local/bin/python",
  "zip -r archive.zip project/ -x '*.git*'",
  "head -n 50 /var/log/syslog",
  "du -sh ~/Downloads/*",
  "alias ll='ls -alF'",
  "history | tail -20",
];

export interface QuizScenario {
  shortcutId: string;
  shortcut: Shortcut;
  prompt: string;
  before: LineState;
  after: LineState;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Place cursor at a meaningful position for the given shortcut category.
 * Movement shortcuts need cursor in the middle; deletion shortcuts need
 * cursor positioned so the operation has visible effect.
 */
function placeCursor(text: string, shortcutId: string): number {
  const len = text.length;
  if (len === 0) return 0;

  switch (shortcutId) {
    // Movement: place cursor somewhere in the middle
    case "ctrl-b":
    case "ctrl-f":
      return randomInt(1, len - 1);

    case "alt-b":
    case "alt-f":
      // Place near middle so there's a word to jump to in either direction
      return randomInt(Math.floor(len * 0.3), Math.floor(len * 0.7));

    case "ctrl-a":
      // Place away from start so movement is visible
      return randomInt(Math.floor(len * 0.4), len);

    case "ctrl-e":
      // Place away from end so movement is visible
      return randomInt(0, Math.floor(len * 0.6));

    // Deletion: place cursor so the operation deletes something meaningful
    case "ctrl-d":
      // Need chars after cursor
      return randomInt(0, len - 1);

    case "ctrl-h":
      // Need chars before cursor
      return randomInt(1, len);

    case "alt-d":
      // Need a word after cursor - find a word char position
      return findPositionBeforeWord(text, true);

    case "ctrl-w":
      // Need a word before cursor - find a position after a word
      return findPositionAfterWord(text);

    case "ctrl-k":
      // Place in middle so there's text to kill after
      return randomInt(Math.floor(len * 0.2), Math.floor(len * 0.6));

    case "ctrl-u":
      // Place in middle so there's text to kill before
      return randomInt(Math.floor(len * 0.4), Math.floor(len * 0.8));

    default:
      return randomInt(0, len);
  }
}

function findPositionBeforeWord(text: string, _forward: boolean): number {
  // Find positions where a word starts (preceded by non-word char or start)
  const wordStarts: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (/[a-zA-Z0-9_]/.test(text[i]) && (i === 0 || !/[a-zA-Z0-9_]/.test(text[i - 1]))) {
      wordStarts.push(i);
    }
  }
  // Pick one that's not too close to start or end
  const candidates = wordStarts.filter((p) => p > 0 && p < text.length - 2);
  return candidates.length > 0 ? pickRandom(candidates) : Math.floor(text.length / 2);
}

function findPositionAfterWord(text: string): number {
  // Find positions just after a word ends
  const wordEnds: number[] = [];
  for (let i = 1; i <= text.length; i++) {
    if (/[a-zA-Z0-9_]/.test(text[i - 1]) && (i === text.length || !/[a-zA-Z0-9_]/.test(text[i]))) {
      wordEnds.push(i);
    }
  }
  const candidates = wordEnds.filter((p) => p > 2 && p < text.length);
  return candidates.length > 0 ? pickRandom(candidates) : Math.floor(text.length / 2);
}

export function generateScenario(shortcutId: string): QuizScenario {
  const shortcut = getShortcutById(shortcutId);
  if (!shortcut) throw new Error(`Unknown shortcut: ${shortcutId}`);

  const text = pickRandom(COMMAND_POOL);
  const cursor = placeCursor(text, shortcutId);
  const before: LineState = { text, cursor };
  const after = applyOperation(shortcutId, before);

  const prompt =
    shortcut.category === "movement"
      ? `Move cursor: ${shortcut.action}`
      : `Delete text: ${shortcut.action}`;

  return { shortcutId, shortcut, prompt, before, after };
}
