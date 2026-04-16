import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import type { Card, DailyRun } from '../data/types';
import {
  getDeck,
  getAllCards,
  getDailyRun,
  saveDailyRun,
  addLog,
  todayString,
  generateId,
} from '../data/storage';
import SwipeableCard, { SwipeDirection } from '../SwipeableCard';
import CardStack from '../CardStack';
import DeckComplete from '../DeckComplete';
import { CARD_WIDTH, CARD_HEIGHT } from '../cardDimensions';

type Props = NativeStackScreenProps<RootStackParamList, 'Play'>;

export default function PlayScreen({ route, navigation }: Props) {
  const { deckId, date } = route.params;
  const [deckName, setDeckName] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [run, setRun] = useState<DailyRun | null>(null);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({
    completed: 0,
    skipped: 0,
    deferred: 0,
    shuffled: 0,
  });
  const [loading, setLoading] = useState(true);
  const totalSwiped = React.useRef(0);

  const flipProgress = useSharedValue(1);
  const shuffleJitter = useSharedValue(0);

  // Load deck + run
  useEffect(() => {
    (async () => {
      const [deck, allCards, dailyRun] = await Promise.all([
        getDeck(deckId),
        getAllCards(),
        getDailyRun(deckId, date),
      ]);
      if (!deck || !dailyRun) {
        navigation.goBack();
        return;
      }
      setDeckName(deck.name);
      setRun(dailyRun);

      // Build ordered card list from run's liveCardStates
      const orderedCards = dailyRun.liveCardStates
        .sort((a, b) => a.position - b.position)
        .map((s) => allCards.find((c) => c.id === s.cardId))
        .filter(Boolean) as Card[];
      setCards(orderedCards);

      // Find first pending card
      const firstPending = dailyRun.liveCardStates
        .sort((a, b) => a.position - b.position)
        .findIndex((s) => s.status === 'pending');
      setCurrentIndex(firstPending >= 0 ? firstPending : orderedCards.length);

      // Count already-processed stats
      const s = { completed: 0, skipped: 0, deferred: 0, shuffled: 0 };
      for (const state of dailyRun.liveCardStates) {
        if (state.status === 'complete') s.completed++;
        else if (state.status === 'skipped') s.skipped++;
      }
      setStats(s);
      setLoading(false);
    })();
  }, [deckId, date, navigation]);

  const triggerFlipReveal = useCallback(() => {
    flipProgress.value = 0;
    flipProgress.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [flipProgress]);

  const triggerShuffleJitter = useCallback(() => {
    shuffleJitter.value = withSequence(
      withTiming(1, { duration: 50 }),
      withTiming(-0.8, { duration: 60 }),
      withTiming(0.6, { duration: 50 }),
      withTiming(-0.3, { duration: 40 }),
      withTiming(0, { duration: 40 })
    );
  }, [shuffleJitter]);

  const persistRun = useCallback(
    async (updatedCards: Card[], newIndex: number, status: DailyRun['status']) => {
      if (!run) return;
      const updatedRun: DailyRun = {
        ...run,
        liveCardStates: updatedCards.map((c, i) => {
          const existing = run.liveCardStates.find((s) => s.cardId === c.id);
          return {
            cardId: c.id,
            status: existing?.status ?? 'pending',
            position: i,
          };
        }),
        status,
        updatedAt: Date.now(),
      };
      setRun(updatedRun);
      await saveDailyRun(updatedRun);
    },
    [run]
  );

  const handleSwipe = useCallback(
    async (direction: SwipeDirection) => {
      if (!run) return;
      totalSwiped.current += 1;
      const currentCard = cards[currentIndex];

      const logStatus =
        direction === 'right'
          ? 'complete'
          : direction === 'up'
          ? 'skipped'
          : direction === 'left'
          ? 'deferred'
          : 'shuffled';

      // Log the swipe
      await addLog({
        id: generateId(),
        date,
        cardId: currentCard.id,
        deckId,
        status: logStatus,
        timestamp: Date.now(),
      });

      switch (direction) {
        case 'right': {
          setStats((s) => ({ ...s, completed: s.completed + 1 }));
          // Mark card complete in run
          const updatedRun = { ...run };
          const stateEntry = updatedRun.liveCardStates.find(
            (s) => s.cardId === currentCard.id
          );
          if (stateEntry) stateEntry.status = 'complete';
          const newIdx = currentIndex + 1;
          const isDone = newIdx >= cards.length;
          updatedRun.status = isDone ? 'complete' : 'in-progress';
          updatedRun.updatedAt = Date.now();
          setRun(updatedRun);
          await saveDailyRun(updatedRun);
          setCurrentIndex(newIdx);
          if (!isDone) triggerFlipReveal();
          break;
        }
        case 'up': {
          setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
          const updatedRun = { ...run };
          const stateEntry = updatedRun.liveCardStates.find(
            (s) => s.cardId === currentCard.id
          );
          if (stateEntry) stateEntry.status = 'skipped';
          const newIdx = currentIndex + 1;
          const isDone = newIdx >= cards.length;
          updatedRun.status = isDone ? 'complete' : 'in-progress';
          updatedRun.updatedAt = Date.now();
          setRun(updatedRun);
          await saveDailyRun(updatedRun);
          setCurrentIndex(newIdx);
          if (!isDone) triggerFlipReveal();
          break;
        }
        case 'left': {
          setStats((s) => ({ ...s, deferred: s.deferred + 1 }));
          setCards((prev) => {
            const next = [...prev];
            const card = next[currentIndex];
            next.splice(currentIndex, 1);
            const insertPos = Math.min(currentIndex + 1, next.length);
            next.splice(insertPos, 0, card);
            return next;
          });
          triggerFlipReveal();
          break;
        }
        case 'down': {
          setStats((s) => ({ ...s, shuffled: s.shuffled + 1 }));
          setCards((prev) => {
            const next = [...prev];
            const card = next[currentIndex];
            next.splice(currentIndex, 1);
            const remaining = next.length - currentIndex;
            if (remaining <= 0) {
              next.splice(currentIndex, 0, card);
            } else {
              const offset = Math.floor(Math.random() * remaining);
              next.splice(
                Math.min(currentIndex + Math.max(offset, 1), next.length),
                0,
                card
              );
            }
            return next;
          });
          triggerFlipReveal();
          triggerShuffleJitter();
          break;
        }
      }
    },
    [
      cards,
      currentIndex,
      run,
      date,
      deckId,
      triggerFlipReveal,
      triggerShuffleJitter,
    ]
  );

  const handleLongPressDismiss = useCallback(async () => {
    setPaused(true);
    if (run) {
      const updated = { ...run, status: 'paused' as const, updatedAt: Date.now() };
      setRun(updated);
      await saveDailyRun(updated);
    }
  }, [run]);

  const handleResume = useCallback(async () => {
    setPaused(false);
    if (run) {
      const updated = {
        ...run,
        status: 'in-progress' as const,
        updatedAt: Date.now(),
      };
      setRun(updated);
      await saveDailyRun(updated);
    }
    triggerFlipReveal();
  }, [run, triggerFlipReveal]);

  // Keyboard shortcuts
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const isDone = currentIndex >= cards.length;
    const handler = (e: KeyboardEvent) => {
      if (paused || isDone) return;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          handleSwipe('right');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSwipe('left');
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleSwipe('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleSwipe('down');
          break;
        case 'p':
          e.preventDefault();
          handleLongPressDismiss();
          break;
        case 'Escape':
          e.preventDefault();
          navigation.goBack();
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [paused, currentIndex, cards.length, handleSwipe, handleLongPressDismiss, navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  const remainingCards = cards.slice(currentIndex);
  const currentCard = remainingCards[0];
  const isDeckComplete = currentIndex >= cards.length && !paused;

  // Paused
  if (paused) {
    return (
      <View style={styles.container}>
        <View style={styles.pausedContainer}>
          <Text style={styles.pausedEmoji}>{'\u23F8\uFE0F'}</Text>
          <Text style={styles.pausedTitle}>Deck Paused</Text>
          <Text style={styles.pausedSubtitle}>
            {cards.length - currentIndex} of {cards.length} cards remaining
          </Text>
          <Pressable style={styles.resumeButton} onPress={handleResume}>
            <Text style={styles.btnText}>Resume</Text>
          </Pressable>
          <Pressable
            style={[styles.resumeButton, { backgroundColor: '#888' }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.btnText}>Back to Deck</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Complete
  if (isDeckComplete) {
    return (
      <View style={styles.container}>
        <DeckComplete
          stats={{ total: totalSwiped.current, ...stats }}
          onRestart={() => navigation.goBack()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'\u2039'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{deckName}</Text>
        <Text style={styles.counter}>
          {currentIndex + 1} of {cards.length}
        </Text>
      </View>

      <View style={styles.cardArea}>
        <View style={styles.cardAnchor}>
          <CardStack cards={remainingCards} shuffleJitter={shuffleJitter} />
          {currentCard && (
            <SwipeableCard
              key={`${currentCard.id}-${currentIndex}`}
              card={currentCard}
              onSwipe={handleSwipe}
              onLongPressDismiss={handleLongPressDismiss}
              flipProgress={flipProgress}
            />
          )}
        </View>
      </View>

      <Text style={styles.hint}>Long-press to pause deck</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0EB', alignItems: 'center' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F0EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { fontSize: 28, color: '#4A90D9', paddingRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  counter: {
    fontSize: 15,
    fontWeight: '500',
    color: '#888',
    fontVariant: ['tabular-nums'],
  },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  cardAnchor: { width: CARD_WIDTH, height: CARD_HEIGHT },
  hint: { fontSize: 12, color: '#aaa', paddingBottom: 8 },
  // Paused
  pausedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  pausedEmoji: { fontSize: 64, marginBottom: 16 },
  pausedTitle: { fontSize: 28, fontWeight: '700', color: '#333', marginBottom: 8 },
  pausedSubtitle: { fontSize: 16, color: '#888', marginBottom: 32 },
  resumeButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#4A90D9',
    borderRadius: 24,
    marginBottom: 12,
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
