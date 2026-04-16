export type RootStackParamList = {
  DeckList: undefined;
  DeckDetail: { deckId: string };
  Play: { deckId: string; date: string };
  CardEditor: { cardId?: string; deckId?: string };
  NewDeck: undefined;
  Stats: undefined;
  Goals: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
