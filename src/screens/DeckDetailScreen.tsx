import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import type { Card, Deck, DailyRun } from '../data/types';
import {
  getDeck,
  saveDeck,
  deleteDeck,
  getAllCards,
  getDailyRun,
  getAllDailyRuns,
  saveDailyRun,
  todayString,
  generateId,
} from '../data/storage';
import {
  requestNotificationPermission,
  scheduleTrigger,
  cancelTrigger,
} from '../data/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckDetail'>;

export default function DeckDetailScreen({ route, navigation }: Props) {
  const { deckId } = route.params;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [todayRun, setTodayRun] = useState<DailyRun | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [d, allCards] = await Promise.all([getDeck(deckId), getAllCards()]);
    if (!d) {
      navigation.goBack();
      return;
    }
    setDeck(d);
    // Order cards by deck position
    const ordered = d.cardRefs
      .sort((a, b) => a.positionInDeck - b.positionInDeck)
      .map((ref) => allCards.find((c) => c.id === ref.cardId))
      .filter(Boolean) as Card[];
    setCards(ordered);

    const run = await getDailyRun(deckId, todayString());
    setTodayRun(run ?? null);
    setLoading(false);
  }, [deckId, navigation]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const toggleOrderMode = async () => {
    if (!deck) return;
    const updated: Deck = {
      ...deck,
      orderMode: deck.orderMode === 'fixed' ? 'random' : 'fixed',
    };
    await saveDeck(updated);
    setDeck(updated);
  };

  const moveCard = async (fromIndex: number, direction: 'up' | 'down') => {
    if (!deck) return;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= deck.cardRefs.length) return;

    const refs = [...deck.cardRefs].sort((a, b) => a.positionInDeck - b.positionInDeck);
    [refs[fromIndex], refs[toIndex]] = [refs[toIndex], refs[fromIndex]];
    refs.forEach((r, i) => (r.positionInDeck = i));

    const updated = { ...deck, cardRefs: refs };
    await saveDeck(updated);
    setDeck(updated);

    // Update cards display order
    const allCards = await getAllCards();
    const ordered = refs
      .map((ref) => allCards.find((c) => c.id === ref.cardId))
      .filter(Boolean) as Card[];
    setCards(ordered);
  };

  const startOrResume = async () => {
    if (!deck) return;
    const today = todayString();
    let run = await getDailyRun(deck.id, today);

    if (!run) {
      // Build card order
      let orderedIds = deck.cardRefs
        .sort((a, b) => a.positionInDeck - b.positionInDeck)
        .map((r) => r.cardId);

      if (deck.orderMode === 'random') {
        // Fisher-Yates shuffle
        for (let i = orderedIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [orderedIds[i], orderedIds[j]] = [orderedIds[j], orderedIds[i]];
        }
        // Anti-repeat: if first card is same as yesterday's first, swap it
        const allRuns = await getAllDailyRuns();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        const yRun = allRuns.find(
          (r) => r.deckId === deck.id && r.date === yStr
        );
        if (
          yRun &&
          yRun.liveCardStates.length > 0 &&
          orderedIds.length > 1 &&
          orderedIds[0] === yRun.liveCardStates[0].cardId
        ) {
          // Swap first with a random other position
          const swapIdx = 1 + Math.floor(Math.random() * (orderedIds.length - 1));
          [orderedIds[0], orderedIds[swapIdx]] = [orderedIds[swapIdx], orderedIds[0]];
        }
      }

      run = {
        date: today,
        deckId: deck.id,
        liveCardStates: orderedIds.map((cardId, i) => ({
          cardId,
          status: 'pending',
          position: i,
        })),
        status: 'in-progress',
        startedAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveDailyRun(run);
    } else if (run.status === 'paused') {
      run.status = 'in-progress';
      run.updatedAt = Date.now();
      await saveDailyRun(run);
    }

    navigation.navigate('Play', { deckId: deck.id, date: today });
  };

  const handleDelete = () => {
    Alert.alert('Delete Deck', `Delete "${deck?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDeck(deckId);
          navigation.goBack();
        },
      },
    ]);
  };

  const getStatusIcon = (cardId: string) => {
    if (!todayRun) return null;
    const state = todayRun.liveCardStates.find((s) => s.cardId === cardId);
    if (!state || state.status === 'pending') return null;
    switch (state.status) {
      case 'complete':
        return '\u2713';
      case 'skipped':
        return '\u2717';
      case 'deferred':
        return '\u21BB';
      case 'shuffled':
        return '\u2261';
    }
  };

  if (loading || !deck) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  const runLabel =
    todayRun?.status === 'paused'
      ? 'Resume'
      : todayRun?.status === 'in-progress'
      ? 'Continue'
      : 'Play';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'\u2039'} Back</Text>
        </Pressable>
        <Pressable onPress={handleDelete}>
          <Text style={styles.deleteBtn}>Delete</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{deck.name}</Text>

      {/* Order mode toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>
          {deck.orderMode === 'fixed' ? '\u2630 Fixed order' : '\uD83D\uDD00 Random order'}
        </Text>
        <Switch
          value={deck.orderMode === 'random'}
          onValueChange={toggleOrderMode}
          trackColor={{ true: '#4A90D9', false: '#ddd' }}
        />
      </View>

      {/* Trigger time */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>
          {deck.trigger?.time ? `Trigger at ${deck.trigger.time}` : 'Daily trigger'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={styles.triggerInput}
            value={deck.trigger?.time ?? ''}
            onChangeText={async (v) => {
              if (!deck) return;
              const time = v.replace(/[^0-9:]/g, '');
              const updated = {
                ...deck,
                trigger: time ? { time } : undefined,
              };
              await saveDeck(updated);
              setDeck(updated);

              if (time && /^\d{2}:\d{2}$/.test(time)) {
                // First trigger set — request permission contextually
                const granted = await requestNotificationPermission();
                if (granted) {
                  scheduleTrigger(updated);
                }
              } else {
                cancelTrigger(deck.id);
              }
            }}
            placeholder="HH:MM"
            placeholderTextColor="#bbb"
            maxLength={5}
          />
        </View>
      </View>

      {/* Play CTA */}
      <Pressable style={styles.playButton} onPress={startOrResume}>
        <Text style={styles.playText}>
          {'\u25B6'} {runLabel}
        </Text>
      </Pressable>

      {/* Card list */}
      <Text style={styles.sectionTitle}>
        Cards ({cards.length})
      </Text>
      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: card, index }) => {
          const icon = getStatusIcon(card.id);
          return (
            <Pressable
              style={styles.cardRow}
              onPress={() =>
                navigation.navigate('CardEditor', {
                  cardId: card.id,
                  deckId: deck.id,
                })
              }
            >
              {deck.orderMode === 'fixed' && (
                <View style={styles.reorderBtns}>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); moveCard(index, 'up'); }}
                    disabled={index === 0}
                    style={styles.reorderBtn}
                  >
                    <Text style={[styles.reorderArrow, index === 0 && styles.reorderDisabled]}>{'\u25B2'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); moveCard(index, 'down'); }}
                    disabled={index === cards.length - 1}
                    style={styles.reorderBtn}
                  >
                    <Text style={[styles.reorderArrow, index === cards.length - 1 && styles.reorderDisabled]}>{'\u25BC'}</Text>
                  </Pressable>
                </View>
              )}
              {deck.orderMode !== 'fixed' && (
                <Text style={styles.cardIndex}>{index + 1}</Text>
              )}
              <Text style={styles.cardTitle} numberOfLines={1}>
                {card.title}
              </Text>
              {card.timer && (
                <Text style={styles.timerBadge}>
                  {card.timer.durationSeconds}s
                </Text>
              )}
              {icon && <Text style={styles.statusIcon}>{icon}</Text>}
              <Text style={styles.chevron}>{'\u203A'}</Text>
            </Pressable>
          );
        }}
      />

      {/* Add card */}
      <Pressable
        style={styles.addCard}
        onPress={() =>
          navigation.navigate('CardEditor', { deckId: deck.id })
        }
      >
        <Text style={styles.addCardText}>+ Add Card</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0EB' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F0EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
  },
  back: { fontSize: 17, color: '#4A90D9' },
  deleteBtn: { fontSize: 15, color: '#F44336' },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 15, color: '#555' },
  triggerInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    color: '#333',
    width: 70,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e5e0db',
  },
  playButton: {
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  playText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: { paddingHorizontal: 16 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    gap: 10,
  },
  cardIndex: {
    fontSize: 14,
    fontWeight: '600',
    color: '#bbb',
    width: 20,
    textAlign: 'center',
  },
  reorderBtns: {
    flexDirection: 'column',
    gap: 2,
    width: 20,
    alignItems: 'center',
  },
  reorderBtn: { padding: 1 },
  reorderArrow: { fontSize: 10, color: '#4A90D9' },
  reorderDisabled: { color: '#ddd' },
  cardTitle: { flex: 1, fontSize: 15, color: '#333' },
  timerBadge: {
    fontSize: 12,
    color: '#4A90D9',
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  chevron: { fontSize: 20, color: '#ccc' },
  addCard: {
    margin: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addCardText: { fontSize: 15, color: '#4A90D9', fontWeight: '600' },
});
