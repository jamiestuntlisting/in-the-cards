import { Platform } from 'react-native';

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
