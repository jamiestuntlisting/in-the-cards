import type { RootStackParamList } from '../navigation';
import { getAllDecks, getAllDailyRuns, todayString } from './storage';

type InitialAction =
  | { screen: 'DeckList' }
  | { screen: 'Play'; params: { deckId: string; date: string } };

/**
 * Determine where to send the user on app launch.
 *
 * Priority:
 * 1. In-progress run from today → jump straight into Play
 * 2. Paused run from today → jump into Play (paused state)
 * 3. Otherwise → DeckList (so user can pick)
 *
 * Goal: user rarely sees the menu; always looking at cards.
 */
export async function determineInitialAction(): Promise<InitialAction> {
  const today = todayString();
  const runs = await getAllDailyRuns();

  // Filter to today's runs, sorted by most-recently-updated first
  const todayRuns = runs
    .filter((r) => r.date === today)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  // Resume an in-progress or paused run from today
  const active = todayRuns.find(
    (r) => r.status === 'in-progress' || r.status === 'paused'
  );

  if (active) {
    // Verify the deck still exists and has cards
    const decks = await getAllDecks();
    const deck = decks.find((d) => d.id === active.deckId);
    if (deck && deck.cardRefs.length > 0) {
      return { screen: 'Play', params: { deckId: active.deckId, date: today } };
    }
  }

  // Default: deck list
  return { screen: 'DeckList' };
}
