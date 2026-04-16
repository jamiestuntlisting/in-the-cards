import type { DailyRun } from './types';
import {
  getAllDecks,
  getAllDailyRuns,
  saveDailyRun,
  todayString,
} from './storage';

/**
 * Midnight rollover — called on app open.
 *
 * For each deck that has an in-progress run from a previous day:
 * - Mark the old run as 'complete' (deck was dismissed by time, not action)
 *
 * New DailyRuns are NOT pre-created — they're created on-demand when the
 * user taps Play in DeckDetail. This avoids creating runs for days the
 * user never opens a deck.
 */
export async function checkMidnightRollover(): Promise<void> {
  const today = todayString();
  const runs = await getAllDailyRuns();

  for (const run of runs) {
    if (run.date !== today && run.status !== 'complete') {
      // Stale run from a previous day — mark complete
      run.status = 'complete';
      run.updatedAt = Date.now();
      await saveDailyRun(run);
    }
  }
}
