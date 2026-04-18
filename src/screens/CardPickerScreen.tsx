import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
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
} from '../data/storage';

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

  // Cards not already in this deck
  const inDeck = new Set(deck?.cardRefs.map((r) => r.cardId) ?? []);
  const available = allCards.filter(
    (c) =>
      !inDeck.has(c.id) &&
      (query.trim() === '' ||
        c.title.toLowerCase().includes(query.toLowerCase()))
  );

  const addCard = async (card: Card) => {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add Card</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Create new */}
      <Pressable
        style={styles.createNewRow}
        onPress={() => {
          navigation.replace('CardEditor', { deckId });
        }}
      >
        <Text style={styles.createNewIcon}>+</Text>
        <Text style={styles.createNewText}>Create new card</Text>
      </Pressable>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search library..."
        placeholderTextColor="#bbb"
      />

      <Text style={styles.sectionTitle}>
        From library ({available.length})
      </Text>

      <FlatList
        data={available}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: card }) => (
          <Pressable style={styles.cardRow} onPress={() => addCard(card)}>
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
              <Text style={styles.timerBadge}>
                {card.timer.durationSeconds}s
              </Text>
            )}
            <Text style={styles.addPlus}>+</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query
              ? 'No matching cards in library.'
              : 'No cards in library yet. Create a new one above.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0EB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e0db',
  },
  cancel: { fontSize: 16, color: '#888' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  createNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90D9',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  createNewIcon: { fontSize: 22, color: '#fff', fontWeight: '700' },
  createNewText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  search: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  cardTitle: { fontSize: 15, color: '#333', fontWeight: '500' },
  cardPreview: { fontSize: 12, color: '#999', marginTop: 2 },
  timerBadge: {
    fontSize: 11,
    color: '#4A90D9',
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  addPlus: {
    fontSize: 22,
    color: '#4A90D9',
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  empty: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 14,
    marginTop: 30,
  },
});
