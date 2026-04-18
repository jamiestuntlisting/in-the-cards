/**
 * In the Cards — Design Tokens
 * Ported from colors_and_type.css (design handoff).
 */

// ─── Paper palette (warm creams) ───
export const paper = {
  0: '#FAF6EF', // lightest — highlight / card face
  1: '#F3EDE2', // page background
  2: '#ECE4D6', // subtle raised surface
  3: '#E1D7C5', // hairline / divider
  4: '#C9BDA7', // disabled / placeholder
};

// ─── Ink palette (warm near-blacks) ───
export const ink = {
  900: '#1A1714', // primary text / card stroke
  800: '#2A2520',
  700: '#4A4239', // secondary text
  600: '#6B6055', // tertiary text
  500: '#8E8373', // placeholder
  400: '#B3A898', // disabled
};

// ─── Suit colors — one per swipe gesture ───
export const suit = {
  heart: '#B8213C', // right swipe — complete
  spade: '#1F2A37', // up swipe — skip
  diamond: '#C89B3C', // left swipe — defer
  club: '#2F6E6A', // down swipe — shuffle
};

export const suitTint = {
  heart: '#F6E1E4',
  spade: '#DDE2E8',
  diamond: '#F3E7C8',
  club: '#D6E5E2',
};

// ─── Signal — brand link / focus ───
export const signal = {
  500: '#3C7FC4',
  400: '#6DA4D6',
  100: '#E4EEF8',
};

// ─── Semantic aliases ───
export const color = {
  bgPage: paper[1],
  bgSurface: paper[0],
  bgRaised: '#FFFFFF', // top-of-stack card
  bgSunken: paper[2],

  fg1: ink[900],
  fg2: ink[700],
  fg3: ink[600],
  fg4: ink[500],
  fgDisabled: ink[400],

  hairline: paper[3],
  hairlineSoft: paper[2],

  link: signal[500],
  linkHover: signal[400],
  focusRing: signal[500],

  statusComplete: suit.heart,
  statusSkipped: suit.spade,
  statusDeferred: suit.diamond,
  statusShuffled: suit.club,

  cardStroke: 'rgba(26, 23, 20, 0.12)', // ink-900 @ 12%
};

// ─── Type scale ───
export const font = {
  display:
    'BodoniSmallcaps, "Bodoni 72 Smallcaps", "Bodoni 72", "Didot", "Bodoni MT", Georgia, serif',
  text: 'InstrumentSans, "Instrument Sans", ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: 'JetBrainsMono, "JetBrains Mono", ui-monospace, Menlo, monospace',
};

export const fontSize = {
  displayXl: 56,
  displayL: 40,
  displayM: 32,
  displayS: 24,

  bodyL: 18,
  body: 16,
  bodyS: 14,

  ui: 15,
  label: 13,
  micro: 11,

  timer: 48,
  counter: 14,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 1.1,
  display: 1.15,
  snug: 1.3,
  body: 1.5,
  loose: 1.7,
};

export const letterSpacing = {
  display: -0.6, // approx -0.02em at 32px
  tight: -0.16,
  normal: 0,
  label: 1.1, // UPPERCASE section labels (0.08em @ 13px)
};

// ─── Spacing (4px base) ───
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 56,
  10: 72,
};

// ─── Radii ───
export const radius = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16, // cards, modals — tentpole
  xl: 24, // FAB, pills
  full: 999,
};

// ─── Shadows — warm-tinted, never cool gray ───
// Web uses boxShadow string; native uses the individual props.
// Each shadow has both forms for cross-platform use.
export const shadow = {
  flat: {
    boxShadow: '0px 1px 2px rgba(40, 28, 20, 0.06)',
  },
  card: {
    boxShadow:
      '0px 4px 12px rgba(40, 28, 20, 0.10), 0px 1px 2px rgba(40, 28, 20, 0.06)',
  },
  lift: {
    boxShadow:
      '0px 12px 32px rgba(40, 28, 20, 0.18), 0px 2px 6px rgba(40, 28, 20, 0.08)',
  },
  fab: {
    boxShadow:
      '0px 8px 20px rgba(184, 33, 60, 0.28), 0px 2px 4px rgba(40, 28, 20, 0.10)',
  },
};

// ─── Motion ───
export const ease = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  in: 'cubic-bezier(0.55, 0, 1, 0.45)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  linear: 'linear',
};

export const duration = {
  instant: 120,
  quick: 200,
  normal: 320,
  slow: 500,
  deal: 600,
  shuffle: 800,
};

// ─── Card geometry ───
export const card = {
  aspectW: 5,
  aspectH: 7,
  strokeWidth: 1,
};
