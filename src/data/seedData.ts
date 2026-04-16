import type { Card, Deck } from './types';
import {
  saveCard,
  saveDeck,
  hasBeenSeeded,
  markSeeded,
  generateId,
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
          'Swipe right to finish. Your Morning, Afternoon, and Evening templates are waiting.',
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

// ─── Template Decks ───

export interface DeckTemplate {
  name: string;
  orderMode: 'fixed' | 'random';
  cards: { title: string; timer?: number }[];
}

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    name: 'Morning',
    orderMode: 'fixed',
    cards: [
      { title: 'Drink a bottle of water' },
      { title: 'Drink tea' },
      { title: 'Do a handstand' },
      { title: 'Core exercises', timer: 60 },
      { title: 'Jump rope', timer: 30 },
      { title: 'Take a shower' },
      { title: 'Eat oatmeal' },
    ],
  },
  {
    name: 'Afternoon',
    orderMode: 'random',
    cards: [
      { title: 'Stand up and stretch', timer: 60 },
      { title: 'Drink a glass of water' },
      { title: 'Step outside for fresh air', timer: 120 },
      { title: 'Eat a piece of fruit' },
      { title: "Write one thing you're grateful for" },
      { title: 'Look away from screen at distance', timer: 30 },
    ],
  },
  {
    name: 'Evening',
    orderMode: 'fixed',
    cards: [
      { title: 'Put phone on charger across the room' },
      { title: 'Journal', timer: 300 },
      { title: 'Stretch', timer: 180 },
      { title: 'Read a book', timer: 600 },
      { title: "Lights out \u2014 set tomorrow's intention" },
    ],
  },
];

export async function createDeckFromTemplate(
  template: DeckTemplate
): Promise<Deck> {
  const now = Date.now();
  const cards: Card[] = template.cards.map((tc, i) => ({
    id: generateId(),
    title: tc.title,
    content: [],
    timer: tc.timer ? { durationSeconds: tc.timer } : undefined,
    createdAt: now,
  }));

  // Save all cards
  for (const card of cards) {
    await saveCard(card);
  }

  const deck: Deck = {
    id: generateId(),
    name: template.name,
    orderMode: template.orderMode,
    cardRefs: cards.map((c, i) => ({ cardId: c.id, positionInDeck: i })),
    createdAt: now,
  };
  await saveDeck(deck);
  return deck;
}

// ─── First-launch seed ───

export async function seedIfNeeded(): Promise<void> {
  if (await hasBeenSeeded()) return;

  const now = Date.now();

  // Save tutorial cards
  for (const cardDef of TUTORIAL_CARDS) {
    await saveCard({ ...cardDef, createdAt: now });
  }

  // Save tutorial deck
  await saveDeck({ ...TUTORIAL_DECK_DEF, createdAt: now });

  await markSeeded();
}
