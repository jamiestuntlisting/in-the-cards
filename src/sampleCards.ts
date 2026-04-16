export interface CardData {
  id: string;
  title: string;
  content: { type: 'text' | 'image'; value: string }[];
  timer?: { durationSeconds: number };
  link?: string;
}

export const TUTORIAL_DECK: CardData[] = [
  {
    id: 'tut-1',
    title: 'Welcome to In the Cards',
    content: [
      {
        type: 'text',
        value: 'Swipe right to complete this card and continue.',
      },
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
      {
        type: 'image',
        value: 'https://picsum.photos/seed/cards/300/200',
      },
    ],
  },
  {
    id: 'tut-7',
    title: 'Make your own deck',
    content: [
      { type: 'text', value: 'Tap here to create a new deck.' },
    ],
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
