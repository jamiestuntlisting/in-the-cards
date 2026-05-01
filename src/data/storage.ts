import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Card,
  Deck,
  DailyRun,
  CompletionLog,
  Goal,
  Settings,
} from './types';

// ─── Storage Keys ───
const KEYS = {
  CARDS: 'itc:cards',
  DECKS: 'itc:decks',
  DAILY_RUNS: 'itc:daily_runs',
  COMPLETION_LOGS: 'itc:completion_logs',
  GOALS: 'itc:goals',
  SETTINGS: 'itc:settings',
  SEEDED: 'itc:tutorial_seeded',
  TUTORIAL_DELETED: 'itc:tutorial_deleted',
} as const;

/**
 * Direct localStorage on web (synchronous, reliable), AsyncStorage on native.
 * This works around any async init weirdness in AsyncStorage on web.
 */
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage.getItem failed', key, e);
      return null;
    }
  }
  return AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch (e) {
      console.warn('localStorage.setItem failed', key, e);
      return;
    }
  }
  await AsyncStorage.setItem(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch (e) {
      return;
    }
  }
  await AsyncStorage.removeItem(key);
}

async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn('Failed to parse JSON for', key, e);
    return null;
  }
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await setItem(key, JSON.stringify(value));
}

// ─── Cards ───

export async function getAllCards(): Promise<Card[]> {
  return (await getJSON<Card[]>(KEYS.CARDS)) ?? [];
}

export async function getCard(id: string): Promise<Card | undefined> {
  const cards = await getAllCards();
  return cards.find((c) => c.id === id);
}

export async function saveCard(card: Card): Promise<void> {
  const cards = await getAllCards();
  const idx = cards.findIndex((c) => c.id === card.id);
  if (idx >= 0) cards[idx] = card;
  else cards.push(card);
  await setJSON(KEYS.CARDS, cards);
}

export async function deleteCard(id: string): Promise<void> {
  const cards = await getAllCards();
  await setJSON(
    KEYS.CARDS,
    cards.filter((c) => c.id !== id)
  );
  const decks = await getAllDecks();
  for (const deck of decks) {
    const before = deck.cardRefs.length;
    deck.cardRefs = deck.cardRefs.filter((r) => r.cardId !== id);
    if (deck.cardRefs.length !== before) {
      deck.cardRefs.forEach((r, i) => (r.positionInDeck = i));
      await saveDeck(deck);
    }
  }
}

// ─── Decks ───

export async function getAllDecks(): Promise<Deck[]> {
  return (await getJSON<Deck[]>(KEYS.DECKS)) ?? [];
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const decks = await getAllDecks();
  return decks.find((d) => d.id === id);
}

export async function saveDeck(deck: Deck): Promise<void> {
  const decks = await getAllDecks();
  const idx = decks.findIndex((d) => d.id === deck.id);
  if (idx >= 0) decks[idx] = deck;
  else decks.push(deck);
  await setJSON(KEYS.DECKS, decks);
}

export async function deleteDeck(id: string): Promise<void> {
  const decks = await getAllDecks();
  await setJSON(
    KEYS.DECKS,
    decks.filter((d) => d.id !== id)
  );
  // If this is the tutorial deck, remember the user deleted it so we don't re-seed
  if (id === 'deck-tutorial') {
    await markTutorialDeleted();
  }
  // Clean up daily runs for this deck
  const runs = await getAllDailyRuns();
  await setJSON(
    KEYS.DAILY_RUNS,
    runs.filter((r) => r.deckId !== id)
  );
}

// ─── Daily Runs ───

export async function getAllDailyRuns(): Promise<DailyRun[]> {
  return (await getJSON<DailyRun[]>(KEYS.DAILY_RUNS)) ?? [];
}

export async function getDailyRun(
  deckId: string,
  date: string
): Promise<DailyRun | undefined> {
  const runs = await getAllDailyRuns();
  return runs.find((r) => r.deckId === deckId && r.date === date);
}

export async function saveDailyRun(run: DailyRun): Promise<void> {
  const runs = await getAllDailyRuns();
  const idx = runs.findIndex(
    (r) => r.deckId === run.deckId && r.date === run.date
  );
  if (idx >= 0) runs[idx] = run;
  else runs.push(run);
  await setJSON(KEYS.DAILY_RUNS, runs);
}

/**
 * Get today's run for a deck, creating it on the fly if missing. Mirrors the
 * "tap a deck on the home screen" path so callers (e.g. time-of-day initial
 * routing) can land the user directly in Play with the right state. Returns
 * null if the deck has no cards. Resumes paused runs; leaves complete runs
 * complete (caller decides what to do).
 */
export async function ensureDailyRun(
  deck: Deck,
  date: string
): Promise<DailyRun | null> {
  if (deck.cardRefs.length === 0) return null;
  let run = await getDailyRun(deck.id, date);
  if (!run) {
    let orderedIds = deck.cardRefs
      .slice()
      .sort((a, b) => a.positionInDeck - b.positionInDeck)
      .map((r) => r.cardId);

    if (deck.orderMode === 'random') {
      for (let i = orderedIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [orderedIds[i], orderedIds[j]] = [orderedIds[j], orderedIds[i]];
      }
    }

    run = {
      date,
      deckId: deck.id,
      liveCardStates: orderedIds.map((cardId, i) => ({
        cardId,
        status: 'pending' as const,
        position: i,
      })),
      status: 'in-progress',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveDailyRun(run);
  } else if (run.status === 'paused') {
    run = { ...run, status: 'in-progress', updatedAt: Date.now() };
    await saveDailyRun(run);
  }
  return run;
}

/**
 * Append new card IDs to today's active DailyRun for `deckId`, if one exists
 * and is in-progress or paused. Idempotent — already-present cards are skipped.
 *
 * Use this when a card is added to a deck while the user is mid-session, so
 * the new card shows up in the live deck without restarting.
 */
export async function appendCardsToActiveRun(
  deckId: string,
  cardIds: string[]
): Promise<void> {
  if (cardIds.length === 0) return;
  const today = todayString();
  const run = await getDailyRun(deckId, today);
  if (!run) return; // no run yet today — fresh play will pick up the new cards
  if (run.status === 'complete') return; // already done; don't reopen
  const existing = new Set(run.liveCardStates.map((s) => s.cardId));
  const toAdd = cardIds.filter((id) => !existing.has(id));
  if (toAdd.length === 0) return;
  const basePos = run.liveCardStates.length;
  const newStates = toAdd.map((cardId, i) => ({
    cardId,
    status: 'pending' as const,
    position: basePos + i,
  }));
  const updated: DailyRun = {
    ...run,
    liveCardStates: [...run.liveCardStates, ...newStates],
    updatedAt: Date.now(),
  };
  await saveDailyRun(updated);
}

// ─── Completion Logs ───

export async function getAllLogs(): Promise<CompletionLog[]> {
  return (await getJSON<CompletionLog[]>(KEYS.COMPLETION_LOGS)) ?? [];
}

export async function addLog(log: CompletionLog): Promise<void> {
  const logs = await getAllLogs();
  logs.push(log);
  await setJSON(KEYS.COMPLETION_LOGS, logs);
}

export async function getLogsForDate(date: string): Promise<CompletionLog[]> {
  const logs = await getAllLogs();
  return logs.filter((l) => l.date === date);
}

export async function getLogsForCard(cardId: string): Promise<CompletionLog[]> {
  const logs = await getAllLogs();
  return logs.filter((l) => l.cardId === cardId);
}

export async function deleteLog(logId: string): Promise<void> {
  const logs = await getAllLogs();
  await setJSON(
    KEYS.COMPLETION_LOGS,
    logs.filter((l) => l.id !== logId)
  );
}

// ─── Goals ───

export async function getAllGoals(): Promise<Goal[]> {
  return (await getJSON<Goal[]>(KEYS.GOALS)) ?? [];
}

export async function saveGoal(goal: Goal): Promise<void> {
  const goals = await getAllGoals();
  const idx = goals.findIndex((g) => g.id === goal.id);
  if (idx >= 0) goals[idx] = goal;
  else goals.push(goal);
  await setJSON(KEYS.GOALS, goals);
}

export async function deleteGoal(id: string): Promise<void> {
  const goals = await getAllGoals();
  await setJSON(
    KEYS.GOALS,
    goals.filter((g) => g.id !== id)
  );
}

// ─── Settings ───

export const ALL_STATS_KEYS = [
  'completion_pct',
  'current_streak',
  'longest_streak',
  'total_swipes',
  'nemesis_card',
  'most_consistent_card',
  'per_card_trends',
  'deck_completion_rate',
  'time_of_day',
  'best_day_of_week',
  'today_log',
] as const;

export const STATS_LABELS: Record<string, string> = {
  completion_pct: 'Completion Rate',
  current_streak: 'Current Streak',
  longest_streak: 'Longest Streak',
  total_swipes: 'Total Swipes',
  nemesis_card: 'Your Nemesis Card',
  most_consistent_card: 'Most Consistent Card',
  per_card_trends: 'Per-Card Trends',
  deck_completion_rate: 'Deck Completion Rate',
  time_of_day: 'Time-of-Day Analysis',
  best_day_of_week: 'Best Day of Week',
  today_log: "Today's Log",
};

const DEFAULT_SETTINGS: Settings = {
  morningTime: '07:00',
  preferredStatsDisplay: [...ALL_STATS_KEYS],
  notificationPermission: 'default',
};

export async function getSettings(): Promise<Settings> {
  const stored = await getJSON<Settings>(KEYS.SETTINGS);
  if (!stored) return { ...DEFAULT_SETTINGS };
  // Merge stored + defaults so new keys added later don't break old saves
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    // Always merge stats display — stored value wins, but empty array still allowed
    preferredStatsDisplay:
      Array.isArray(stored.preferredStatsDisplay)
        ? stored.preferredStatsDisplay
        : DEFAULT_SETTINGS.preferredStatsDisplay,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setJSON(KEYS.SETTINGS, settings);
}

// ─── Seed tracking ───

export async function hasBeenSeeded(): Promise<boolean> {
  const val = await getItem(KEYS.SEEDED);
  return val === 'true';
}

export async function markSeeded(): Promise<void> {
  await setItem(KEYS.SEEDED, 'true');
}

export async function hasUserDeletedTutorial(): Promise<boolean> {
  const val = await getItem(KEYS.TUTORIAL_DELETED);
  return val === 'true';
}

export async function markTutorialDeleted(): Promise<void> {
  await setItem(KEYS.TUTORIAL_DELETED, 'true');
}

// ─── Helpers ───

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Export / Import / Reset — for backup and cross-device transfer ───

export interface DataBundle {
  version: 1;
  exportedAt: number;
  cards: Card[];
  decks: Deck[];
  runs: DailyRun[];
  logs: CompletionLog[];
  goals: Goal[];
  settings: Settings;
}

/**
 * Dump all stored state as a JSON string — paste into another device's
 * Import box to move your cards across.
 */
export async function exportAllData(): Promise<string> {
  const [cards, decks, runs, logs, goals, settings] = await Promise.all([
    getAllCards(),
    getAllDecks(),
    getAllDailyRuns(),
    getAllLogs(),
    getAllGoals(),
    getSettings(),
  ]);
  const bundle: DataBundle = {
    version: 1,
    exportedAt: Date.now(),
    cards,
    decks,
    runs,
    logs,
    goals,
    settings,
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Restore state from an exported JSON string. Merges with existing data
 * by default (existing ids win). Set `mode: 'replace'` to wipe first.
 */
export async function importAllData(
  json: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{
  cards: number;
  decks: number;
  runs: number;
  logs: number;
  goals: number;
}> {
  const parsed = JSON.parse(json) as Partial<DataBundle>;

  // Basic shape validation
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Import file is not a JSON object.');
  }
  const cards = Array.isArray(parsed.cards) ? parsed.cards : [];
  const decks = Array.isArray(parsed.decks) ? parsed.decks : [];
  const runs = Array.isArray(parsed.runs) ? parsed.runs : [];
  const logs = Array.isArray(parsed.logs) ? parsed.logs : [];
  const goals = Array.isArray(parsed.goals) ? parsed.goals : [];
  const settings = parsed.settings;

  if (mode === 'replace') {
    await setJSON(KEYS.CARDS, cards);
    await setJSON(KEYS.DECKS, decks);
    await setJSON(KEYS.DAILY_RUNS, runs);
    await setJSON(KEYS.COMPLETION_LOGS, logs);
    await setJSON(KEYS.GOALS, goals);
    if (settings) await setJSON(KEYS.SETTINGS, settings);
  } else {
    // Merge: existing ids win
    const mergeById = <T extends { id: string }>(
      existing: T[],
      incoming: T[]
    ): T[] => {
      const existingIds = new Set(existing.map((x) => x.id));
      return [...existing, ...incoming.filter((x) => !existingIds.has(x.id))];
    };

    const [
      existingCards,
      existingDecks,
      existingRuns,
      existingLogs,
      existingGoals,
    ] = await Promise.all([
      getAllCards(),
      getAllDecks(),
      getAllDailyRuns(),
      getAllLogs(),
      getAllGoals(),
    ]);

    await setJSON(KEYS.CARDS, mergeById(existingCards, cards));
    await setJSON(KEYS.DECKS, mergeById(existingDecks, decks));
    // Runs keyed by (deckId + date), not id — merge manually
    const runKey = (r: DailyRun) => `${r.deckId}::${r.date}`;
    const existingRunKeys = new Set(existingRuns.map(runKey));
    await setJSON(KEYS.DAILY_RUNS, [
      ...existingRuns,
      ...runs.filter((r) => !existingRunKeys.has(runKey(r))),
    ]);
    await setJSON(KEYS.COMPLETION_LOGS, mergeById(existingLogs, logs));
    await setJSON(KEYS.GOALS, mergeById(existingGoals, goals));
    // Settings: incoming wins if present
    if (settings) await setJSON(KEYS.SETTINGS, settings);
  }

  return {
    cards: cards.length,
    decks: decks.length,
    runs: runs.length,
    logs: logs.length,
    goals: goals.length,
  };
}

export interface DataCounts {
  cards: number;
  decks: number;
  runs: number;
  logs: number;
  goals: number;
}

export async function countAllData(): Promise<DataCounts> {
  const [cards, decks, runs, logs, goals] = await Promise.all([
    getAllCards(),
    getAllDecks(),
    getAllDailyRuns(),
    getAllLogs(),
    getAllGoals(),
  ]);
  return {
    cards: cards.length,
    decks: decks.length,
    runs: runs.length,
    logs: logs.length,
    goals: goals.length,
  };
}

/**
 * Return every key localStorage has on this origin — useful to see what
 * the app actually has stored (including legacy keys from old builds).
 */
export function dumpRawLocalStorage(): Array<{ key: string; bytes: number }> {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const out: Array<{ key: string; bytes: number }> = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const value = window.localStorage.getItem(key) ?? '';
    out.push({ key, bytes: value.length });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Wipe all itc:* storage. Irreversible.
 */
export async function resetAllData(): Promise<void> {
  const keys = Object.values(KEYS);
  for (const k of keys) {
    await removeItem(k);
  }
}
