import type { Card, Deck, CompletionLog, DailyRun } from './types';

export interface StatsSummary {
  totalSwipes: number;
  completed: number;
  skipped: number;
  deferred: number;
  shuffled: number;
  completionPct: number;
  currentStreak: number;
  longestStreak: number;
}

export interface PerCardStat {
  cardId: string;
  title: string;
  complete: number;
  skipped: number;
  deferred: number;
  shuffled: number;
  total: number;
  completionPct: number;
}

export interface DeckLevelStat {
  deckId: string;
  name: string;
  daysPlayed: number;
  daysComplete: number; // days where all cards in the deck's latest run were completed
  completionPct: number;
}

export interface TimeOfDay {
  morning: number; // 5am-12pm
  afternoon: number; // 12pm-5pm
  evening: number; // 5pm-10pm
  lateNight: number; // 10pm-5am
}

/**
 * Summary stats over a filtered set of logs.
 */
export function computeSummary(
  logs: CompletionLog[],
  allLogsForStreaks: CompletionLog[]
): StatsSummary {
  const completed = logs.filter((l) => l.status === 'complete').length;
  const skipped = logs.filter((l) => l.status === 'skipped').length;
  const deferred = logs.filter((l) => l.status === 'deferred').length;
  const shuffled = logs.filter((l) => l.status === 'shuffled').length;
  const total = logs.length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Streaks are computed over ALL logs (not filtered by period)
  // Current streak: consecutive days with at least one complete
  const completeDates = [
    ...new Set(
      allLogsForStreaks.filter((l) => l.status === 'complete').map((l) => l.date)
    ),
  ].sort();

  let currentStreak = 0;
  let checkDate = new Date().toISOString().slice(0, 10);
  const dateSet = new Set(completeDates);
  while (dateSet.has(checkDate)) {
    currentStreak++;
    const d = new Date(checkDate);
    d.setDate(d.getDate() - 1);
    checkDate = d.toISOString().slice(0, 10);
  }

  // Longest streak: longest run of consecutive dates
  let longestStreak = 0;
  let runLen = 0;
  let prev: string | null = null;
  for (const d of completeDates) {
    if (prev === null) {
      runLen = 1;
    } else {
      const prevDate = new Date(prev);
      prevDate.setDate(prevDate.getDate() + 1);
      if (prevDate.toISOString().slice(0, 10) === d) {
        runLen++;
      } else {
        runLen = 1;
      }
    }
    longestStreak = Math.max(longestStreak, runLen);
    prev = d;
  }

  return {
    totalSwipes: total,
    completed,
    skipped,
    deferred,
    shuffled,
    completionPct,
    currentStreak,
    longestStreak,
  };
}

/**
 * Per-card stats — aggregated counts over the given logs.
 */
export function computePerCardStats(
  logs: CompletionLog[],
  cards: Card[]
): PerCardStat[] {
  const byCard = new Map<string, PerCardStat>();

  for (const card of cards) {
    byCard.set(card.id, {
      cardId: card.id,
      title: card.title,
      complete: 0,
      skipped: 0,
      deferred: 0,
      shuffled: 0,
      total: 0,
      completionPct: 0,
    });
  }

  for (const log of logs) {
    const stat = byCard.get(log.cardId);
    if (!stat) continue;
    stat.total++;
    if (log.status === 'complete') stat.complete++;
    else if (log.status === 'skipped') stat.skipped++;
    else if (log.status === 'deferred') stat.deferred++;
    else if (log.status === 'shuffled') stat.shuffled++;
  }

  for (const stat of byCard.values()) {
    stat.completionPct =
      stat.total > 0 ? Math.round((stat.complete / stat.total) * 100) : 0;
  }

  return [...byCard.values()].filter((s) => s.total > 0);
}

/**
 * "Nemesis card" — the card you most often defer or skip.
 */
export function findNemesisCard(perCard: PerCardStat[]): PerCardStat | null {
  if (perCard.length === 0) return null;
  return [...perCard].sort(
    (a, b) => (b.deferred + b.skipped) - (a.deferred + a.skipped)
  )[0];
}

/**
 * "Most consistent card" — the card with the highest completion rate (min 3 attempts).
 */
export function findMostConsistentCard(
  perCard: PerCardStat[]
): PerCardStat | null {
  const qualifying = perCard.filter((s) => s.total >= 3);
  if (qualifying.length === 0) return null;
  return [...qualifying].sort((a, b) => b.completionPct - a.completionPct)[0];
}

/**
 * Deck-level completion rate.
 */
export function computeDeckLevelStats(
  logs: CompletionLog[],
  decks: Deck[]
): DeckLevelStat[] {
  // For each deck, determine how many days it was played and how many of those
  // days all cards were completed.
  const results: DeckLevelStat[] = [];

  for (const deck of decks) {
    const deckLogs = logs.filter((l) => l.deckId === deck.id);
    const datesPlayed = [...new Set(deckLogs.map((l) => l.date))];
    const deckCardIds = new Set(deck.cardRefs.map((r) => r.cardId));

    let daysComplete = 0;
    for (const date of datesPlayed) {
      const dayLogs = deckLogs.filter((l) => l.date === date);
      const completedCardIds = new Set(
        dayLogs.filter((l) => l.status === 'complete').map((l) => l.cardId)
      );
      // Deck day is "complete" if every card in the deck was completed
      const allComplete = [...deckCardIds].every((id) =>
        completedCardIds.has(id)
      );
      if (allComplete) daysComplete++;
    }

    const rate =
      datesPlayed.length > 0
        ? Math.round((daysComplete / datesPlayed.length) * 100)
        : 0;

    results.push({
      deckId: deck.id,
      name: deck.name,
      daysPlayed: datesPlayed.length,
      daysComplete,
      completionPct: rate,
    });
  }

  return results.filter((r) => r.daysPlayed > 0);
}

/**
 * Time-of-day breakdown — when does the user typically play?
 */
export function computeTimeOfDay(logs: CompletionLog[]): TimeOfDay {
  const buckets: TimeOfDay = { morning: 0, afternoon: 0, evening: 0, lateNight: 0 };
  for (const log of logs) {
    const hour = new Date(log.timestamp).getHours();
    if (hour >= 5 && hour < 12) buckets.morning++;
    else if (hour >= 12 && hour < 17) buckets.afternoon++;
    else if (hour >= 17 && hour < 22) buckets.evening++;
    else buckets.lateNight++;
  }
  return buckets;
}

/**
 * Best day of week — the day with highest completion rate.
 */
export function computeBestDayOfWeek(
  logs: CompletionLog[]
): { day: string; rate: number } | null {
  const byDow: Record<
    number,
    { complete: number; total: number }
  > = {};
  for (let i = 0; i < 7; i++) byDow[i] = { complete: 0, total: 0 };

  for (const log of logs) {
    const dow = new Date(log.timestamp).getDay();
    byDow[dow].total++;
    if (log.status === 'complete') byDow[dow].complete++;
  }

  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let best = { day: '', rate: -1 };
  for (let i = 0; i < 7; i++) {
    if (byDow[i].total === 0) continue;
    const rate = Math.round((byDow[i].complete / byDow[i].total) * 100);
    if (rate > best.rate) {
      best = { day: names[i], rate };
    }
  }

  return best.rate >= 0 ? best : null;
}

/**
 * Average wall-clock duration (ms) of all complete runs for a given deck.
 * Returns null if the deck has never been completed.
 *
 * A "run duration" is updatedAt - startedAt on a DailyRun whose status
 * is 'complete'. This includes any time the deck spent paused.
 */
export function computeDeckAvgRunMs(
  runs: DailyRun[],
  deckId: string
): number | null {
  const completed = runs.filter(
    (r) => r.deckId === deckId && r.status === 'complete'
  );
  if (completed.length === 0) return null;
  const total = completed.reduce(
    (sum, r) => sum + Math.max(0, r.updatedAt - r.startedAt),
    0
  );
  return Math.round(total / completed.length);
}

/**
 * Formatted duration string from ms — "12s", "1m 34s", "1h 4m".
 * Used for the avg-run display on Deck Detail.
 */
export function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes >= 5) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

