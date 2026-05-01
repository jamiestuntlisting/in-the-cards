/**
 * Deal each card in a deck its own playing-card identity (rank + suit) so the
 * Vegas-style corner pips read like a real deck — Ace of Hearts, King of Spades,
 * etc. — instead of every card being the same Ace of Hearts.
 *
 * Identities are deterministic from the deck id, so a card keeps its identity
 * across reloads. Within a deck, identities are unique up to 52 cards (we
 * shuffle a full 52-card pack); past 52 we wrap.
 */

import { suit as suitColor } from './design/tokens';

export type Suit = 'heart' | 'spade' | 'diamond' | 'club';

export interface CardIdentity {
  rank: string; // 'A', '2'..'10', 'J', 'Q', 'K'
  suit: Suit;
}

const RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];
const SUITS: Suit[] = ['heart', 'spade', 'diamond', 'club'];

// FNV-1a 32-bit string hash → seed for the PRNG below.
function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mulberry32 — small, fast, deterministic.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPack(): CardIdentity[] {
  const out: CardIdentity[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      out.push({ rank: r, suit: s });
    }
  }
  return out;
}

const memo = new Map<string, CardIdentity[]>();

/**
 * Return a deterministic, shuffled 52-card pack for this deck. Cached so
 * repeated calls within the session don't re-shuffle.
 */
export function dealForDeck(deckId: string): CardIdentity[] {
  let cached = memo.get(deckId);
  if (cached) return cached;
  const rand = mulberry32(seedFromString(deckId));
  const pack = buildPack();
  // Fisher–Yates with our seeded RNG
  for (let i = pack.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pack[i], pack[j]] = [pack[j], pack[i]];
  }
  memo.set(deckId, pack);
  return pack;
}

/**
 * The identity for a card at `position` within the deck definition (i.e. its
 * `cardRefs[].positionInDeck`, NOT the live shuffled position). Stable so the
 * same card reads as the same playing-card every session.
 */
export function identityFor(
  deckId: string,
  position: number
): CardIdentity {
  const pack = dealForDeck(deckId);
  const idx = ((position % pack.length) + pack.length) % pack.length;
  return pack[idx];
}

/** Color the rank/pip should render in for this suit. */
export function colorForSuit(s: Suit): string {
  return suitColor[s];
}

/** Sensible fallback when we don't yet know the card's identity (new card). */
export const DEFAULT_IDENTITY: CardIdentity = { rank: 'A', suit: 'heart' };
