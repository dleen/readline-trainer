export interface SrsFields {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string; // ISO date string
}

export interface SrsUpdate {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
}

export function updateSrs(fields: SrsFields, correct: boolean): SrsUpdate {
  let { easeFactor, intervalDays, repetitions } = fields;

  if (correct) {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    easeFactor = Math.max(1.3, easeFactor + 0.1);
  } else {
    repetitions = 0;
    intervalDays = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);
  const nextReviewAt = nextReview.toISOString();

  return { easeFactor, intervalDays, repetitions, nextReviewAt };
}

export interface CardForSelection {
  id: string;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string;
  sessionAttempts: number;
  sessionCorrect: number;
  /** Whether the card was answered wrong in this session and not yet re-answered correctly */
  failedInSession: boolean;
}

export interface SessionState {
  newCardsIntroduced: number;
  lastCardId: string | null;
}

/**
 * Select the next card to quiz using in-session SRS priority tiers.
 * Returns the selected card id, or null if no cards are available.
 */
export function selectNextCard(cards: CardForSelection[], session: SessionState): string | null {
  const eligible = cards.filter((c) => c.id !== session.lastCardId);
  if (eligible.length === 0) {
    // If only one card left, allow repeating
    if (cards.length === 1) return cards[0].id;
    return null;
  }

  const now = new Date().toISOString();

  // Tier 1: Failed in this session, not yet re-answered correctly
  const tier1 = eligible.filter((c) => c.failedInSession);

  // Tier 2: Past next_review_at (due for review)
  const tier2 = eligible.filter(
    (c) => !c.failedInSession && c.nextReviewAt <= now && c.sessionAttempts > 0
  );

  // Tier 3: Never seen in any session (new cards), max 3 per session
  const tier3 =
    session.newCardsIntroduced < 3
      ? eligible.filter(
          (c) => !c.failedInSession && c.sessionAttempts === 0 && c.intervalDays === 0 && c.nextReviewAt <= now
        )
      : [];

  // Tier 4: Low ease factor cards for extra practice
  const tier4 = eligible.filter(
    (c) => !c.failedInSession && !tier2.includes(c) && !tier3.includes(c)
  );

  const tier = tier1.length > 0 ? tier1 : tier2.length > 0 ? tier2 : tier3.length > 0 ? tier3 : tier4;

  if (tier.length === 0) return null;

  return weightedRandomPick(tier);
}

function weightedRandomPick(cards: CardForSelection[]): string {
  const weights = cards.map((c) => 1 / c.easeFactor);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * totalWeight;

  for (let i = 0; i < cards.length; i++) {
    r -= weights[i];
    if (r <= 0) return cards[i].id;
  }

  return cards[cards.length - 1].id;
}
