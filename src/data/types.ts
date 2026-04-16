// ─── Core Data Types ───

export interface Card {
  id: string;
  title: string;
  content: ContentBlock[];
  timer?: { durationSeconds: number };
  link?: string;
  createdAt: number;
}

export interface ContentBlock {
  type: 'text' | 'image';
  value: string;
}

export interface Deck {
  id: string;
  name: string;
  orderMode: 'fixed' | 'random';
  cardRefs: { cardId: string; positionInDeck: number }[];
  trigger?: { time: string }; // 'HH:MM'
  createdAt: number;
}

export interface DailyRun {
  date: string; // 'YYYY-MM-DD'
  deckId: string;
  liveCardStates: LiveCardState[];
  status: 'in-progress' | 'paused' | 'complete';
  startedAt: number;
  updatedAt: number;
}

export interface LiveCardState {
  cardId: string;
  status: 'pending' | 'complete' | 'skipped' | 'deferred' | 'shuffled';
  position: number;
}

export interface CompletionLog {
  id: string;
  date: string; // 'YYYY-MM-DD'
  cardId: string;
  deckId: string;
  status: 'complete' | 'skipped' | 'deferred' | 'shuffled';
  timestamp: number;
}

export interface Goal {
  id: string;
  name: string;
  cardIds: string[];
  successRule: 'all-complete-daily';
  createdAt: number;
}

export interface Settings {
  morningTime: string; // 'HH:MM'
  preferredStatsDisplay: string[];
  notificationPermission: 'granted' | 'denied' | 'default';
  timezone?: string;
}
