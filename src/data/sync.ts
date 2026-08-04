import { Platform } from 'react-native';
import { exportAllData, importAllData } from './storage';

/**
 * Cloud sync via /api/sync (Vercel serverless + Redis).
 *
 * The user invents a "sync code" — a secret passphrase. All app data is
 * pushed to the server under a hash of that code after every change
 * (debounced), and pulled+merged on app start. Entering the same code on
 * another device links it to the same data.
 */

const CODE_KEY = 'itc:sync_code';
const STATUS_KEY = 'itc:sync_status'; // { lastPushAt?, lastPullAt?, lastError? }

export interface SyncStatus {
  lastPushAt?: number;
  lastPullAt?: number;
  lastError?: string;
}

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

export function getSyncCode(): string | null {
  if (!isWeb()) return null;
  try {
    return window.localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}

export function setSyncCode(code: string | null): void {
  if (!isWeb()) return;
  try {
    if (code && code.trim().length > 0) {
      window.localStorage.setItem(CODE_KEY, code.trim());
    } else {
      window.localStorage.removeItem(CODE_KEY);
    }
  } catch {
    // storage unavailable — sync simply stays off
  }
}

export function getSyncStatus(): SyncStatus {
  if (!isWeb()) return {};
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as SyncStatus) : {};
  } catch {
    return {};
  }
}

function patchStatus(patch: Partial<SyncStatus>): void {
  if (!isWeb()) return;
  try {
    const next = { ...getSyncStatus(), ...patch };
    window.localStorage.setItem(STATUS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

async function callSync(body: {
  code: string;
  action: 'push' | 'pull';
  data?: string;
}): Promise<any> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ?? `Sync failed (HTTP ${res.status})`);
  }
  return json;
}

/** Push the full local bundle to the server. */
export async function pushNow(): Promise<{ ok: boolean; error?: string }> {
  const code = getSyncCode();
  if (!code) return { ok: false, error: 'Sync is off (no sync code set).' };
  try {
    const data = await exportAllData();
    await callSync({ code, action: 'push', data });
    patchStatus({ lastPushAt: Date.now(), lastError: undefined });
    return { ok: true };
  } catch (e: any) {
    const error = e?.message ?? 'Push failed.';
    patchStatus({ lastError: error });
    return { ok: false, error };
  }
}

/**
 * Pull the server bundle and merge it into local data. Merge keeps existing
 * local ids and adds anything the server has that this device lacks.
 */
export async function pullNow(): Promise<{
  ok: boolean;
  empty?: boolean;
  error?: string;
}> {
  const code = getSyncCode();
  if (!code) return { ok: false, error: 'Sync is off (no sync code set).' };
  try {
    const res = await callSync({ code, action: 'pull' });
    if (res.empty) {
      patchStatus({ lastPullAt: Date.now(), lastError: undefined });
      return { ok: true, empty: true };
    }
    await importAllData(res.data, 'merge');
    patchStatus({ lastPullAt: Date.now(), lastError: undefined });
    return { ok: true };
  } catch (e: any) {
    const error = e?.message ?? 'Pull failed.';
    patchStatus({ lastError: error });
    return { ok: false, error };
  }
}

// ─── Auto-push — debounced so bursts of writes become one upload ───

const PUSH_DEBOUNCE_MS = 4000;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePush(): void {
  if (!getSyncCode()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, PUSH_DEBOUNCE_MS);
}

// ─── Automatic identity + recovery link ───
//
// Backup requires zero setup: on first launch the app generates a random
// identity and starts pushing. The identity travels in a "recovery link"
// (…/#recover=<id>) — opening the app through that link on any device (or
// after a storage wipe) adopts the identity and pulls everything back.
// Add the recovery link to the home screen and the daily-use icon IS the key.

function generateSyncId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Extract the identity from a #recover= fragment. Null if none present. */
function codeFromHash(hash: string): string | null {
  const m = /[#&?]recover=([^&\s]+)/.exec(hash ?? '');
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Parse whatever the user pastes into the restore box — a full recovery
 * link or a bare code. Returns the code, or null if unusable.
 */
export function parseRecoveryInput(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const fromLink = codeFromHash(t);
  if (fromLink) return fromLink;
  return t.length >= 6 ? t : null;
}

/** The shareable recovery link for this device's identity. */
export function getRecoveryLink(): string | null {
  const code = getSyncCode();
  if (!code || !isWeb()) return null;
  return `${window.location.origin}/#recover=${encodeURIComponent(code)}`;
}

/**
 * Boot-time identity setup. Order matters:
 * 1. A #recover= fragment in the launch URL adopts that identity — this is
 *    how home-screen bookmarks and shared links restore a device.
 * 2. Otherwise, if no identity exists yet, generate one so backup is on
 *    from the very first session.
 */
export function initSyncIdentity(): void {
  if (!isWeb()) return;
  try {
    const fromUrl = codeFromHash(window.location.hash);
    if (fromUrl && fromUrl.length >= 6 && fromUrl !== getSyncCode()) {
      setSyncCode(fromUrl);
    }
    if (!getSyncCode()) {
      setSyncCode(generateSyncId());
      // Brand-new identity: push soon so the first backup exists right after
      // seeding finishes.
      schedulePush();
    }
  } catch {
    // Never let identity setup break app boot.
  }
}

/**
 * Adopt an identity pasted by the user (recovery link or bare code):
 * pull that identity's data first (merge), then push the combined state.
 */
export async function adoptRecovery(
  input: string
): Promise<{ ok: boolean; error?: string }> {
  const code = parseRecoveryInput(input);
  if (!code) {
    return { ok: false, error: 'That does not look like a recovery link.' };
  }
  const previous = getSyncCode();
  setSyncCode(code);
  const pull = await pullNow();
  if (!pull.ok) {
    setSyncCode(previous);
    return { ok: false, error: pull.error };
  }
  return pushNow();
}
