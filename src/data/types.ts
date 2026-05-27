// ─── Core Data Types ───

export interface Card {
  id: string;
  title: string;
  content: ContentBlock[];
  timer?: { durationSeconds: number };
  link?: string;
  createdAt: number;
  /**
   * Maximum number of right-swipe completions before the card retires from
   * future runs. Undefined = no limit (the card runs forever). Skips, defers,
   * and shuffles do NOT count toward this limit.
   */
  completionLimit?: number;
  /** How many times the card has been right-swiped. Defaults to 0. */
  completionCount?: number;
  /**
   * Optional question the user answers while playing the card. The answer is
   * captured on right-swipe (complete) and stored as a CardResponse. See below.
   */
  prompt?: CardPrompt;
}

/**
 * A question attached to a card. A card may ask for a 0–10 scale rating, a
 * free-text note, or both. `label` is the (optional) question text shown above
 * the inputs during play.
 */
export interface CardPrompt {
  label?: string;
  /** Ask for a 0–10 numeric rating. */
  scale: boolean;
  /** Ask for a free-text response. */
  text: boolean;
}

/** True if the prompt actually asks for at least one kind of answer. */
export function promptIsActive(prompt: CardPrompt | undefined): boolean {
  return !!prompt && (prompt.scale || prompt.text);
}

/**
 * A single recorded answer to a card's prompt, captured when the card is
 * completed (right-swiped). `scale` and/or `text` are present depending on
 * what the card's prompt asked for and what the user entered.
 */
export interface CardResponse {
  id: string;
  cardId: string;
  deckId: string;
  date: string; // 'YYYY-MM-DD'
  timestamp: number;
  /** 0–10 rating, if the prompt asked for a scale and the user picked one. */
  scale?: number;
  /** Free-text answer, if the prompt asked for text and the user entered any. */
  text?: string;
}

export function isCardRetired(card: Card): boolean {
  return (
    card.completionLimit != null &&
    (card.completionCount ?? 0) >= card.completionLimit
  );
}

export interface ContentBlock {
  type: 'text' | 'image';
  value: string;
}

export interface Deck {
  id: string;
  name: string;
  orderMode: 'fixed' | 'random';
  cardRefs: { cardId: string; positionInDeck: number }[];
  trigger?: { time: string }; // 'HH:MM'
  createdAt: number;
}

export interface DailyRun {
  date: string; // 'YYYY-MM-DD'
  deckId: string;
  liveCardStates: LiveCardState[];
  status: 'in-progress' | 'paused' | 'complete';
  startedAt: number;
  updatedAt: number;
}

export interface LiveCardState {
  cardId: string;
  status: 'pending' | 'complete' | 'skipped' | 'deferred' | 'shuffled';
  position: number;
  /** When the card first became the top card of the deck (ms since epoch). */
  startedAt?: number;
  /** When the card was swiped (complete/skip terminal swipes, ms since epoch). */
  endedAt?: number;
}

export interface CompletionLog {
  id: string;
  date: string; // 'YYYY-MM-DD'
  cardId: string;
  deckId: string;
  status: 'complete' | 'skipped' | 'deferred' | 'shuffled';
  timestamp: number;
}

export interface Goal {
  id: string;
  name: string;
  cardIds: string[];
  successRule: 'all-complete-daily';
  createdAt: number;
}

export interface Settings {
  morningTime: string; // 'HH:MM'
  preferredStatsDisplay: string[];
  notificationPermission: 'granted' | 'denied' | 'default';
  timezone?: string;
}
