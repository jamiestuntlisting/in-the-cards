import { Platform } from 'react-native';
import { exportAllData, importAllData } from './storage';

/**
 * Cloud backup via /api/sync (Cloudflare Worker + Workers KV).
 *
 * Each device holds a private "sync code" — its identity. All app data is
 * pushed to the server under a hash of that code after every change
 * (debounced), and pulled on app start. The code is generated per device on
 * first run and never shared, so two people never land on the same backup
 * and never see each other's cards. Linking a second device to the same data
 * is an explicit, confirmed restore (see adoptRecovery below).
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
 * Pull the server bundle into local data.
 *
 * `mode: 'merge'` (default) keeps existing local ids and adds anything the
 * server has that this device lacks — right for one person's second device
 * syncing its own backup.
 *
 * `mode: 'replace'` overwrites local data with the backup — right for a
 * restore, where the point is to reproduce the backup exactly rather than
 * fuse it with whatever happened to be on this device.
 */
export async function pullNow(
  mode: 'merge' | 'replace' = 'merge'
): Promise<{
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
    await importAllData(res.data, mode);
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
// identity and starts pushing. Every device gets its OWN identity, so every
// person sees only their own cards.
//
// The identity travels in a "recovery link" (…/#recover=<id>). That link is
// a private key, not a share link: anyone who opens the app through it is
// asking to load that backup. Two rules keep one person's deck from bleeding
// into another's:
//
//   1. The fragment is stripped from the URL the instant it is read, so the
//      address bar never carries the key and a copied/shared URL cannot hand
//      someone else's deck to whoever opens it.
//   2. A link is only adopted silently on a device that has no identity of
//      its own yet (first run, or a wiped device restoring itself). A device
//      that already belongs to someone keeps its own identity; the link is
//      held aside and Settings offers an explicit, confirmed restore.

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
 * Remove the #recover= fragment from the address bar without reloading, so
 * the key stops travelling with any URL the user copies or shares.
 */
function stripRecoveryHash(): void {
  if (!isWeb()) return;
  try {
    const hash = window.location.hash ?? '';
    if (!/[#&?]recover=/.test(hash)) return;
    const cleaned = hash
      .replace(/^#/, '')
      // Drop the recover param wherever it sits, keeping its separator so
      // any other fragment params survive, then tidy dangling separators.
      .replace(/(^|[?&])recover=[^&]*/g, (_m, sep: string) => sep)
      .replace(/\?&/g, '?')
      .replace(/&&+/g, '&')
      .replace(/[?&]$/, '');
    const url =
      window.location.pathname +
      window.location.search +
      (cleaned ? `#${cleaned}` : '');
    window.history.replaceState(null, '', url);
  } catch {
    // Address-bar tidying is best-effort — never block boot on it.
  }
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

/** This device's private recovery link. Treat it like a password. */
export function getRecoveryLink(): string | null {
  const code = getSyncCode();
  if (!code || !isWeb()) return null;
  return `${window.location.origin}/#recover=${encodeURIComponent(code)}`;
}

// A recovery link opened on a device that already has its own identity is
// parked here (session-scoped) instead of being applied. Settings surfaces
// it so the user can confirm the restore — which replaces this device's
// data — rather than silently fusing two people's decks.
const OFFERED_KEY = 'itc:offered_recovery';

function setOfferedRecovery(code: string | null): void {
  if (!isWeb()) return;
  try {
    if (code) window.sessionStorage.setItem(OFFERED_KEY, code);
    else window.sessionStorage.removeItem(OFFERED_KEY);
  } catch {
    // sessionStorage unavailable — the offer just isn't surfaced
  }
}

/** A recovery link this device declined to adopt automatically, if any. */
export function getOfferedRecovery(): string | null {
  if (!isWeb()) return null;
  try {
    return window.sessionStorage.getItem(OFFERED_KEY);
  } catch {
    return null;
  }
}

/** Dismiss the parked recovery offer. */
export function clearOfferedRecovery(): void {
  setOfferedRecovery(null);
}

export interface IdentityInit {
  /** A recovery link was adopted — boot should restore, not merge. */
  adopted: boolean;
  /** A fresh identity was minted for this device. */
  created: boolean;
  /** A link was present but this device kept its own identity. */
  offered: boolean;
}

/**
 * Boot-time identity setup.
 *
 * 1. Read and immediately strip any #recover= fragment.
 * 2. Adopt it only when this device has no identity of its own — a first run
 *    or a wiped device pulling its backup back. Anything else keeps its own
 *    identity and parks the link for an explicit restore in Settings.
 * 3. With still no identity, mint one so backup is on from session one.
 */
export function initSyncIdentity(): IdentityInit {
  const result: IdentityInit = {
    adopted: false,
    created: false,
    offered: false,
  };
  if (!isWeb()) return result;
  try {
    const fromUrl = codeFromHash(window.location.hash);
    stripRecoveryHash();
    const current = getSyncCode();

    if (fromUrl && fromUrl.length >= 6 && fromUrl !== current) {
      if (!current) {
        // Nothing on this device to protect — this is a restore.
        setSyncCode(fromUrl);
        result.adopted = true;
      } else {
        // This device already belongs to someone. Adopting here is what
        // makes two people's card sets overlap, so ask first.
        setOfferedRecovery(fromUrl);
        result.offered = true;
      }
    }

    if (!getSyncCode()) {
      setSyncCode(generateSyncId());
      result.created = true;
      // Brand-new identity: push soon so the first backup exists right after
      // seeding finishes.
      schedulePush();
    }
  } catch {
    // Never let identity setup break app boot.
  }
  return result;
}

/**
 * Adopt an identity pasted by the user (recovery link or bare code).
 *
 * A restore REPLACES this device's data with that backup. It deliberately
 * does not merge and does not push local data up first: merging fuses two
 * card sets permanently, and pushing would write this device's cards into
 * the other identity's backup — the two ways decks leak between people.
 */
export async function adoptRecovery(
  input: string
): Promise<{ ok: boolean; error?: string }> {
  const code = parseRecoveryInput(input);
  if (!code) {
    return { ok: false, error: 'That does not look like a recovery link.' };
  }
  const previous = getSyncCode();
  if (code === previous) {
    return { ok: false, error: 'That is already this device\u2019s own link.' };
  }
  setSyncCode(code);
  const pull = await pullNow('replace');
  if (!pull.ok) {
    setSyncCode(previous);
    return { ok: false, error: pull.error };
  }
  if (pull.empty) {
    // No backup under that code. Restoring nothing would leave this device's
    // cards attached to a stranger's identity and upload them there on the
    // next write — so back out entirely.
    setSyncCode(previous);
    return {
      ok: false,
      error: 'No backup found for that link. Nothing was changed.',
    };
  }
  clearOfferedRecovery();
  return { ok: true };
}

/**
 * Cut this device loose onto a brand-new identity. Use when a device ended
 * up sharing a backup with someone else: after this, its cards are its own
 * and nothing it writes reaches the old backup.
 *
 * Local data is left alone — the caller decides whether to also wipe it.
 */
export function startFreshIdentity(): string | null {
  if (!isWeb()) return null;
  try {
    const id = generateSyncId();
    setSyncCode(id);
    clearOfferedRecovery();
    return id;
  } catch {
    return null;
  }
}
