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

/**
 * Enable sync with a code: pull whatever the server has first (so a second
 * device inherits existing data instead of clobbering it), then push the
 * merged state back up.
 */
export async function enableSync(
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (code.trim().length < 6) {
    return { ok: false, error: 'Sync code must be at least 6 characters.' };
  }
  setSyncCode(code);
  const pull = await pullNow();
  if (!pull.ok) {
    setSyncCode(null);
    return { ok: false, error: pull.error };
  }
  return pushNow();
}

export function disableSync(): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  setSyncCode(null);
}
