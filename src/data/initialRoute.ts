import {
  ensureDailyRun,
  getAllDecks,
  getAllDailyRuns,
  todayString,
} from './storage';
import { TEMPLATE_DEFAULT_TRIGGERS } from './seedData';
import type { Deck } from './types';

type InitialAction =
  | { screen: 'DeckList' }
  | { screen: 'Play'; params: { deckId: string; date: string } };

/** "HH:MM" → minutes-since-midnight. Returns -1 if unparseable. */
function timeToMinutes(hhmm: string | undefined): number {
  if (!hhmm) return -1;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return -1;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return -1;
  return h * 60 + mm;
}

/**
 * Effective trigger time for a deck — explicit `deck.trigger.time` wins,
 * but if a deck shares its name with a known template (Morning / Afternoon /
 * Evening) we fall back to that template's default. This catches users who
 * created template decks before the trigger field existed.
 */
function effectiveTriggerMinutes(deck: Deck): number {
  if (deck.trigger?.time) return timeToMinutes(deck.trigger.time);
  const fallback = TEMPLATE_DEFAULT_TRIGGERS[deck.name];
  return fallback ? timeToMinutes(fallback) : -1;
}

/**
 * Determine where to send the user on app launch.
 *
 * Priority:
 * 1. In-progress / paused run from today → resume Play (the user was mid-session).
 * 2. A deck whose trigger time has already passed today AND today's run isn't
 *    complete → jump straight into Play. Among multiple eligible decks we pick
 *    the one with the latest trigger that's still <= now (i.e. you opened the
 *    app at 8pm — go to Evening, not Morning).
 * 3. Otherwise → DeckList.
 *
 * Goal: user rarely sees the menu; always looking at cards.
 */
export async function determineInitialAction(): Promise<InitialAction> {
  const today = todayString();
  const [runs, decks] = await Promise.all([
    getAllDailyRuns(),
    getAllDecks(),
  ]);

  // 1. Resume any in-progress / paused run from today (most recently updated)
  const todayRuns = runs
    .filter((r) => r.date === today)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const active = todayRuns.find(
    (r) => r.status === 'in-progress' || r.status === 'paused'
  );
  if (active) {
    const deck = decks.find((d) => d.id === active.deckId);
    if (deck && deck.cardRefs.length > 0) {
      return { screen: 'Play', params: { deckId: active.deckId, date: today } };
    }
  }

  // 2. Time-of-day routing: pick the deck whose trigger has fired most recently
  //    today and isn't already finished.
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const completedDeckIds = new Set(
    todayRuns.filter((r) => r.status === 'complete').map((r) => r.deckId)
  );

  type Candidate = { deck: Deck; triggerMinutes: number };
  const candidates: Candidate[] = decks
    .filter((d) => d.cardRefs.length > 0)
    .filter((d) => !completedDeckIds.has(d.id))
    .map((deck) => ({ deck, triggerMinutes: effectiveTriggerMinutes(deck) }))
    .filter((c) => c.triggerMinutes >= 0 && c.triggerMinutes <= nowMinutes);

  if (candidates.length > 0) {
    // Latest trigger wins. Tie-break by deck name for determinism.
    candidates.sort((a, b) => {
      if (b.triggerMinutes !== a.triggerMinutes) {
        return b.triggerMinutes - a.triggerMinutes;
      }
      return a.deck.name.localeCompare(b.deck.name);
    });
    const winner = candidates[0].deck;
    // Make sure today's run actually exists before we route into Play —
    // PlayScreen otherwise navigates back when the run is missing.
    const ensured = await ensureDailyRun(winner, today);
    if (ensured) {
      return {
        screen: 'Play',
        params: { deckId: winner.id, date: today },
      };
    }
  }

  // 3. Default
  return { screen: 'DeckList' };
}
