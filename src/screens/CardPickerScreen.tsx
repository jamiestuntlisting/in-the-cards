import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import type { Card, Deck } from '../data/types';
import {
  getAllCards,
  getDeck,
  saveDeck,
  saveCard,
  generateId,
} from '../data/storage';
import {
  STANDARD_CARDS,
  isTutorialCardId,
  type StandardCardTemplate,
} from '../data/seedData';
import ScreenContainer from '../components/ScreenContainer';
import {
  color,
  font,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  suit,
  suitTint,
} from '../design/tokens';
import { PlusIcon, TimerIcon } from '../design/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'CardPicker'>;

export default function CardPickerScreen({ route, navigation }: Props) {
  const { deckId } = route.params;
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      Promise.all([getAllCards(), getDeck(deckId)]).then(([c, d]) => {
        setAllCards(c);
        setDeck(d ?? null);
      });
    }, [deckId])
  );

  const inDeck = new Set(deck?.cardRefs.map((r) => r.cardId) ?? []);

  // User library — all cards minus tutorial cards and cards already in this deck
  const userCards = allCards.filter(
    (c) => !inDeck.has(c.id) && !isTutorialCardId(c.id)
  );

  // Filter by search query
  const matchesQuery = (title: string) =>
    query.trim() === '' || title.toLowerCase().includes(query.toLowerCase());

  const filteredUserCards = userCards.filter((c) => matchesQuery(c.title));

  // Standard cards — hide if a card with the same title already exists in user library or this deck
  const existingTitles = new Set(
    allCards.map((c) => c.title.toLowerCase())
  );
  const inDeckTitles = new Set(
    (deck?.cardRefs ?? []).map((ref) => {
      const c = allCards.find((x) => x.id === ref.cardId);
      return c?.title.toLowerCase() ?? '';
    })
  );
  const filteredStandardCards = STANDARD_CARDS.filter(
    (t) =>
      !existingTitles.has(t.title.toLowerCase()) &&
      !inDeckTitles.has(t.title.toLowerCase()) &&
      matchesQuery(t.title)
  );

  const addExistingCard = async (card: Card) => {
    if (!deck) return;
    const updated: Deck = {
      ...deck,
      cardRefs: [
        ...deck.cardRefs,
        { cardId: card.id, positionInDeck: deck.cardRefs.length },
      ],
    };
    await saveDeck(updated);
    navigation.goBack();
  };

  const addStandardCard = async (tmpl: StandardCardTemplate) => {
    if (!deck) return;
    // Materialize a real card in the library, then add to deck
    const newCard: Card = {
      id: generateId(),
      title: tmpl.title,
      content: [],
      timer: tmpl.timer ? { durationSeconds: tmpl.timer } : undefined,
      createdAt: Date.now(),
    };
    await saveCard(newCard);
    const updated: Deck = {
      ...deck,
      cardRefs: [
        ...deck.cardRefs,
        { cardId: newCard.id, positionInDeck: deck.cardRefs.length },
      ],
    };
    await saveDeck(updated);
    navigation.goBack();
  };

  const formatTimerLabel = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds % 60 === 0) return `${seconds / 60}m`;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add Card</Text>
        <View style={{ width: 50 }} />
      </View>

      <Pressable
        style={styles.createNewRow}
        onPress={() => {
          navigation.replace('CardEditor', { deckId });
        }}
      >
        <PlusIcon size={18} color="#fff" strokeWidth={2.2} />
        <Text style={styles.createNewText}>Create new card</Text>
      </Pressable>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search..."
        placeholderTextColor={color.fg4}
      />

      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      >
        {filteredUserCards.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Your library ({filteredUserCards.length})
            </Text>
            {filteredUserCards.map((card) => (
              <Pressable
                key={card.id}
                style={styles.cardRow}
                onPress={() => addExistingCard(card)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {card.title}
                  </Text>
                  {card.content.length > 0 &&
                    card.content[0].type === 'text' && (
                      <Text style={styles.cardPreview} numberOfLines={1}>
                        {card.content[0].value}
                      </Text>
                    )}
                </View>
                {card.timer && (
                  <View style={styles.timerBadge}>
                    <TimerIcon
                      size={11}
                      color={suit.club}
                      strokeWidth={2.2}
                    />
                    <Text style={styles.timerBadgeText}>
                      {formatTimerLabel(card.timer.durationSeconds)}
                    </Text>
                  </View>
                )}
                <PlusIcon size={18} color={color.link} strokeWidth={2.2} />
              </Pressable>
            ))}
          </>
        )}

        {filteredStandardCards.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Standard cards
            </Text>
            {filteredStandardCards.map((tmpl, i) => (
              <Pressable
                key={`std-${i}`}
                style={[styles.cardRow, styles.standardRow]}
                onPress={() => addStandardCard(tmpl)}
              >
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {tmpl.title}
                </Text>
                {tmpl.timer && (
                  <View style={styles.timerBadge}>
                    <TimerIcon
                      size={11}
                      color={suit.club}
                      strokeWidth={2.2}
                    />
                    <Text style={styles.timerBadgeText}>
                      {formatTimerLabel(tmpl.timer)}
                    </Text>
                  </View>
                )}
                <PlusIcon size={18} color={color.link} strokeWidth={2.2} />
              </Pressable>
            ))}
          </>
        )}

        {filteredUserCards.length === 0 &&
          filteredStandardCards.length === 0 && (
            <Text style={styles.empty}>
              {query
                ? 'No matches. Create a new card above.'
                : 'No cards available. Create one above.'}
            </Text>
          )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bgPage },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[9],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
  },
  cancel: {
    fontFamily: font.text,
    fontSize: fontSize.body,
    color: color.fg3,
  },
  headerTitle: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  createNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: suit.heart,
    marginHorizontal: space[4],
    marginTop: space[3],
    borderRadius: radius.m,
    padding: 14,
    gap: space[2],
  },
  createNewText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: '#fff',
    fontWeight: fontWeight.semibold,
  },
  search: {
    fontFamily: font.text,
    backgroundColor: color.bgRaised,
    marginHorizontal: space[4],
    marginTop: space[3],
    borderRadius: radius.m,
    padding: space[3],
    fontSize: fontSize.ui,
    color: color.fg1,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  sectionTitle: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fg3,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  list: { paddingHorizontal: space[4], paddingBottom: space[8] },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: space[3],
    marginBottom: space[1] + 2,
    gap: space[3] - 2,
    borderWidth: 1,
    borderColor: color.cardStroke,
  },
  standardRow: {
    backgroundColor: color.bgSurface,
    borderStyle: 'dashed',
    borderColor: color.hairline,
  },
  cardTitle: {
    flex: 1,
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.fg1,
    fontWeight: fontWeight.medium,
  },
  cardPreview: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg4,
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: suitTint.club,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  timerBadgeText: {
    fontFamily: font.mono,
    fontSize: fontSize.micro,
    color: suit.club,
    fontWeight: fontWeight.medium,
  },
  empty: {
    fontFamily: font.text,
    textAlign: 'center',
    color: color.fg4,
    fontSize: fontSize.bodyS,
    marginTop: space[7],
  },
});
