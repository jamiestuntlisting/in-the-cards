import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Card, Deck, DailyRun, CompletionLog, Goal, Settings } from './types';

// ─── Storage Keys ───
const KEYS = {
  CARDS: 'cards',
  DECKS: 'decks',
  DAILY_RUNS: 'daily_runs',
  COMPLETION_LOGS: 'completion_logs',
  GOALS: 'goals',
  SETTINGS: 'settings',
  SEEDED: 'tutorial_seeded',
} as const;

// ─── Generic helpers ───

async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
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
  // Also remove from all decks
  const decks = await getAllDecks();
  for (const deck of decks) {
    const before = deck.cardRefs.length;
    deck.cardRefs = deck.cardRefs.filter((r) => r.cardId !== id);
    if (deck.cardRefs.length !== before) {
      // Re-index positions
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

const DEFAULT_SETTINGS: Settings = {
  morningTime: '07:00',
  preferredStatsDisplay: [
    'completion_pct',
    'current_streak',
    'longest_streak',
    'today_log',
  ],
  notificationPermission: 'default',
};

export async function getSettings(): Promise<Settings> {
  return (await getJSON<Settings>(KEYS.SETTINGS)) ?? { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setJSON(KEYS.SETTINGS, settings);
}

// ─── Seed check ───

export async function hasBeenSeeded(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.SEEDED);
  return val === 'true';
}

export async function markSeeded(): Promise<void> {
  await AsyncStorage.setItem(KEYS.SEEDED, 'true');
}

// ─── Date helpers ───

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
