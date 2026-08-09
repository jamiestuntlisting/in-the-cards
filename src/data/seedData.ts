import type { Card, Deck } from './types';
import {
  saveCard,
  saveDeck,
  hasBeenSeeded,
  markSeeded,
  hasUserDeletedTutorial,
} from './storage';

// ─── Tutorial Deck ───

const TUTORIAL_CARDS: Omit<Card, 'createdAt'>[] = [
  {
    id: 'tut-1',
    title: 'Welcome to In the Cards',
    content: [
      { type: 'text', value: 'Swipe right to complete this card and continue.' },
    ],
  },
  {
    id: 'tut-2',
    title: 'This is how you skip',
    content: [
      {
        type: 'text',
        value:
          "Not feeling it? Swipe up to skip. Skips are logged but don't count as done.",
      },
    ],
  },
  {
    id: 'tut-3',
    title: 'Defer for later',
    content: [
      {
        type: 'text',
        value:
          "Swipe left to put this card behind the next one. Good for 'not yet, but soon.'",
      },
    ],
  },
  {
    id: 'tut-4',
    title: 'Shuffle it',
    content: [
      {
        type: 'text',
        value:
          'Swipe down to shuffle this card back into the deck randomly. Lets fate decide.',
      },
    ],
  },
  {
    id: 'tut-5',
    title: 'Cards can have timers',
    content: [
      {
        type: 'text',
        value:
          "Tap Start below. When it ends, the card blinks. Swipe whenever you're ready.",
      },
    ],
    timer: { durationSeconds: 3 },
  },
  {
    id: 'tut-6',
    title: 'Cards can have images',
    content: [
      {
        type: 'text',
        value:
          'Cards can hold text, images, and links. Edit any card by long-pressing it in the Deck view.',
      },
      { type: 'image', value: 'https://picsum.photos/seed/cards/300/200' },
    ],
  },
  {
    id: 'tut-9',
    title: 'Cards can ask questions',
    content: [
      {
        type: 'text',
        value:
          'Pick a rating or jot a note below \u2014 your answer is saved when you complete the card. Edit the card later to see the history.',
      },
    ],
    prompt: { label: 'How are you feeling?', scale: true, text: true },
  },
  {
    id: 'tut-10',
    title: 'Some cards are one-and-done',
    content: [
      {
        type: 'text',
        value:
          'This card has a run limit of 1. Complete it and it retires to the Completed section of the deck \u2014 handy for to-dos.',
      },
    ],
    completionLimit: 1,
  },
  {
    id: 'tut-11',
    title: 'Arrange your deck',
    content: [
      {
        type: 'text',
        value:
          'In the deck view, long-press a card and drag to reorder. Rotate your phone sideways for a full-card view.',
      },
    ],
  },
  {
    id: 'tut-7',
    title: 'Make your own deck',
    content: [{ type: 'text', value: 'Tap here to create a new deck.' }],
    link: '#new-deck',
  },
  {
    id: 'tut-8',
    title: "That's it \u2014 you're ready",
    content: [
      {
        type: 'text',
        value:
          'Swipe right to finish, then create your own deck. Everything backs up automatically \u2014 your recovery link is in Settings.',
      },
    ],
  },
];

const TUTORIAL_DECK_DEF: Omit<Deck, 'createdAt'> = {
  id: 'deck-tutorial',
  name: 'Tutorial',
  orderMode: 'fixed',
  cardRefs: TUTORIAL_CARDS.map((c, i) => ({
    cardId: c.id,
    positionInDeck: i,
  })),
};

// ─── Tutorial card ID prefix — used to filter out of library pickers ───
export const TUTORIAL_CARD_IDS = new Set(TUTORIAL_CARDS.map((c) => c.id));

export function isTutorialCardId(id: string): boolean {
  return TUTORIAL_CARD_IDS.has(id);
}

// ─── Standard cards — common activities users might want ───
// These are NOT persisted — they're offered in the card picker and only
// saved (with a fresh id) if the user actually adds them to a deck.
export interface StandardCardTemplate {
  title: string;
  timer?: number;
}

export const STANDARD_CARDS: StandardCardTemplate[] = [
  { title: 'Drink a glass of water' },
  { title: 'Go for a walk', timer: 600 },
  { title: 'Stretch', timer: 180 },
  { title: 'Go for a run', timer: 1200 },
  { title: 'Meditate', timer: 300 },
  { title: 'Read a book', timer: 900 },
  { title: 'Take deep breaths', timer: 60 },
  { title: "Write one thing you're grateful for" },
  { title: 'Do push-ups', timer: 60 },
  { title: 'Do sit-ups', timer: 60 },
  { title: 'Eat a piece of fruit' },
  { title: 'Call a friend' },
  { title: 'Step outside for fresh air', timer: 120 },
  { title: 'Journal', timer: 300 },
  { title: 'Take vitamins' },
  { title: 'Floss' },
  { title: 'Make the bed' },
  { title: 'Tidy one surface' },
  { title: 'Plan tomorrow' },
  { title: 'No-screen break', timer: 300 },
];

// ─── First-launch seed ───

export async function seedIfNeeded(): Promise<void> {
  // If already seeded OR user explicitly deleted the tutorial, never re-seed.
  if (await hasBeenSeeded()) return;
  if (await hasUserDeletedTutorial()) {
    // Still mark seeded so we don't re-check on every launch
    await markSeeded();
    return;
  }

  const now = Date.now();

  // Save tutorial cards
  for (const cardDef of TUTORIAL_CARDS) {
    await saveCard({ ...cardDef, createdAt: now });
  }

  // Save tutorial deck
  await saveDeck({ ...TUTORIAL_DECK_DEF, createdAt: now });

  await markSeeded();
}
