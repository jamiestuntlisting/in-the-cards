import { Platform } from 'react-native';
import { getAllDecks, saveDeck } from './storage';
import { TEMPLATE_DEFAULT_TRIGGERS } from './seedData';

/**
 * One-time migration: old storage keys (`cards`, `decks`, ...) → namespaced
 * (`itc:cards`, `itc:decks`, ...). Users who created data before the
 * namespacing change still have it under the old keys; this copies it over
 * on next launch so nothing is lost.
 *
 * Safe to run on every launch — it no-ops after the first successful run.
 */

const LEGACY_KEYS = [
  'cards',
  'decks',
  'daily_runs',
  'completion_logs',
  'goals',
  'settings',
  'tutorial_seeded',
  'tutorial_deleted',
] as const;

const NEW_PREFIX = 'itc:';
const MIGRATION_FLAG = 'itc:legacy_migration_done';

export function migrateLegacyStorage(): void {
  if (Platform.OS !== 'web') return;

  try {
    const ls = window.localStorage;
    if (ls.getItem(MIGRATION_FLAG) === 'true') return;

    let migratedCount = 0;

    for (const key of LEGACY_KEYS) {
      const newKey = NEW_PREFIX + key;
      const legacyValue = ls.getItem(key);
      const newValue = ls.getItem(newKey);

      // Migrate only if the legacy key has data AND the new key is empty.
      // This avoids clobbering data the user created after the namespacing change.
      if (legacyValue != null && newValue == null) {
        ls.setItem(newKey, legacyValue);
        migratedCount++;
      }
      // Either way, clear the legacy key so it doesn't linger.
      if (legacyValue != null) {
        ls.removeItem(key);
      }
    }

    ls.setItem(MIGRATION_FLAG, 'true');

    if (migratedCount > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[migrate] Restored ${migratedCount} storage bucket(s) from legacy keys.`
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[migrate] Legacy storage migration failed', e);
  }
}

/**
 * Backfill default triggers on decks created from the Morning / Afternoon /
 * Evening templates before triggers were a thing. Runs once per origin —
 * idempotent thereafter via a flag.
 */
const TRIGGER_BACKFILL_FLAG = 'itc:trigger_backfill_done';

export async function backfillTemplateTriggers(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (window.localStorage.getItem(TRIGGER_BACKFILL_FLAG) === 'true') return;
    } catch {
      // ignore — fall through and try the work anyway
    }
  }

  try {
    const decks = await getAllDecks();
    let touched = 0;
    for (const deck of decks) {
      if (deck.trigger?.time) continue;
      const defaultTime = TEMPLATE_DEFAULT_TRIGGERS[deck.name];
      if (!defaultTime) continue;
      await saveDeck({ ...deck, trigger: { time: defaultTime } });
      touched++;
    }
    if (Platform.OS === 'web') {
      window.localStorage.setItem(TRIGGER_BACKFILL_FLAG, 'true');
    }
    if (touched > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[migrate] Backfilled trigger time on ${touched} template deck(s).`
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[migrate] Trigger backfill failed', e);
  }
}
