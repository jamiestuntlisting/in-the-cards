import { Platform } from 'react-native';
import type { Deck } from './types';
import { getSettings, saveSettings } from './storage';

/**
 * Request notification permission — called contextually on first trigger set.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (!('Notification' in window)) return false;

  const result = await Notification.requestPermission();
  const settings = await getSettings();
  settings.notificationPermission =
    result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'default';
  await saveSettings(settings);
  return result === 'granted';
}

/**
 * Schedule a daily notification for a deck's trigger time.
 * On web we use a simple setInterval check since there's no real push API
 * without a service worker. This is a best-effort implementation.
 */
const activeTimers = new Map<string, ReturnType<typeof setInterval>>();

export function scheduleTrigger(deck: Deck): void {
  if (Platform.OS !== 'web') return;
  if (!deck.trigger?.time) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Clear existing timer for this deck
  cancelTrigger(deck.id);

  // Check every 30 seconds if it's trigger time
  const timer = setInterval(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (hhmm === deck.trigger!.time) {
      new Notification(`Time for: ${deck.name}`, {
        body: `${deck.cardRefs.length} cards waiting`,
        tag: `deck-${deck.id}`, // Prevents duplicate notifications
      });
    }
  }, 30_000);

  activeTimers.set(deck.id, timer);
}

export function cancelTrigger(deckId: string): void {
  const existing = activeTimers.get(deckId);
  if (existing) {
    clearInterval(existing);
    activeTimers.delete(deckId);
  }
}

/**
 * Initialize triggers for all decks that have them.
 * Called on app startup.
 */
export async function initTriggers(decks: Deck[]): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  for (const deck of decks) {
    if (deck.trigger?.time) {
      scheduleTrigger(deck);
    }
  }
}
