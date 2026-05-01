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
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation';
import type { Card, Deck, DailyRun, LiveCardState } from '../data/types';
import {
  getDeck,
  getAllDecks,
  getAllCards,
  getDailyRun,
  getAllDailyRuns,
  saveDailyRun,
  deleteDeck,
  addLog,
  deleteLog,
  todayString,
  generateId,
} from '../data/storage';
import SwipeableCard, { SwipeDirection } from '../SwipeableCard';
import CardStack from '../CardStack';
import DeckComplete from '../DeckComplete';
import { identityFor } from '../cardIdentity';
import { CARD_WIDTH, CARD_HEIGHT } from '../cardDimensions';
import {
  color,
  font,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  space,
  suit,
} from '../design/tokens';
import {
  ChevronLeftIcon,
  PauseIcon,
  UndoIcon,
  PlayIcon,
} from '../design/icons';
import ScreenContainer from '../components/ScreenContainer';

type Props = NativeStackScreenProps<RootStackParamList, 'Play'>;

export default function PlayScreen({ route, navigation }: Props) {
  const { deckId, date } = route.params;
  const [deckName, setDeckName] = useState('');
  /**
   * Map of cardId → its original position in the deck definition. Used to
   * deal a stable playing-card identity (Ace of Hearts, King of Spades…) per
   * card. We snapshot it once at load time so reorders during the run don't
   * change a card's identity.
   */
  const [originalPositionByCardId, setOriginalPositionByCardId] = useState<
    Record<string, number>
  >({});
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

  // Undo stack: snapshot of state before the most recent swipe
  type Snapshot = {
    cards: Card[];
    currentIndex: number;
    stats: typeof stats;
    runLiveStates: DailyRun['liveCardStates'];
    runStatus: DailyRun['status'];
    logId: string;
  };
  const [undoSnapshot, setUndoSnapshot] = useState<Snapshot | null>(null);

  // Next deck to offer on completion (first incomplete deck other than this one)
  const [nextDeck, setNextDeck] = useState<Deck | null>(null);

  const flipProgress = useSharedValue(1);
  const shuffleJitter = useSharedValue(0);

  // Load deck + run
  useEffect(() => {
    (async () => {
      const [deck, allCards, loadedRun] = await Promise.all([
        getDeck(deckId),
        getAllCards(),
        getDailyRun(deckId, date),
      ]);
      if (!deck || !loadedRun) {
        navigation.goBack();
        return;
      }
      setDeckName(deck.name);
      // Snapshot original positions for identity-dealing
      const posMap: Record<string, number> = {};
      for (const ref of deck.cardRefs) {
        posMap[ref.cardId] = ref.positionInDeck;
      }
      setOriginalPositionByCardId(posMap);

      // Reconcile: any cards that were added to the deck after the run was
      // created should appear at the end of the live deck. This catches any
      // path that didn't already call appendCardsToActiveRun.
      let dailyRun = loadedRun;
      const liveIds = new Set(dailyRun.liveCardStates.map((s) => s.cardId));
      const missingDeckIds = deck.cardRefs
        .map((r) => r.cardId)
        .filter((id) => !liveIds.has(id));
      if (missingDeckIds.length > 0 && dailyRun.status !== 'complete') {
        const basePos = dailyRun.liveCardStates.length;
        const newStates = missingDeckIds.map((cardId, i) => ({
          cardId,
          status: 'pending' as const,
          position: basePos + i,
        }));
        dailyRun = {
          ...dailyRun,
          liveCardStates: [...dailyRun.liveCardStates, ...newStates],
          updatedAt: Date.now(),
        };
        await saveDailyRun(dailyRun);
      }

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

      // Find next deck to suggest (other deck not yet complete today, with cards)
      const [allDecks, allRuns] = await Promise.all([
        getAllDecks(),
        getAllDailyRuns(),
      ]);
      const completedTodayIds = new Set(
        allRuns
          .filter((r) => r.date === date && r.status === 'complete')
          .map((r) => r.deckId)
      );
      const candidate = allDecks.find(
        (d) =>
          d.id !== deckId &&
          d.cardRefs.length > 0 &&
          !completedTodayIds.has(d.id)
      );
      setNextDeck(candidate ?? null);

      setLoading(false);
    })();
  }, [deckId, date, navigation]);

  // When the user returns from the Card Editor, the card they edited may
  // have a new title / blocks / timer. Refresh the cards array in place
  // (preserving order + currentIndex) so the live deck reflects edits.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const allCards = await getAllCards();
        if (cancelled) return;
        setCards((prev) =>
          prev.map((c) => allCards.find((x) => x.id === c.id) ?? c)
        );
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

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
      const logId = generateId();
      await addLog({
        id: logId,
        date,
        cardId: currentCard.id,
        deckId,
        status: logStatus,
        timestamp: Date.now(),
      });

      // Snapshot state BEFORE the swipe for undo
      setUndoSnapshot({
        cards: [...cards],
        currentIndex,
        stats: { ...stats },
        runLiveStates: run.liveCardStates.map((s) => ({ ...s })),
        runStatus: run.status,
        logId,
      });

      // Helper: auto-remove the tutorial deck once the user finishes it.
      // The user has "graduated" — they don't need it cluttering their list.
      const maybeAutoDeleteTutorial = async (isDone: boolean) => {
        if (isDone && deckId === 'deck-tutorial') {
          await deleteDeck(deckId);
        }
      };

      // Rewrites liveCardStates so positions match `newOrder` and the swiped
      // card's status/endedAt is stamped. Preserves any existing startedAt.
      const rebuildRunStates = (
        newOrder: Card[],
        swipedCardId: string,
        newStatus: LiveCardState['status'],
        now: number
      ): LiveCardState[] =>
        newOrder.map((c, i) => {
          const existing = run.liveCardStates.find(
            (s) => s.cardId === c.id
          );
          const base: LiveCardState = existing
            ? { ...existing }
            : { cardId: c.id, status: 'pending', position: i };
          base.position = i;
          if (c.id === swipedCardId) {
            base.status = newStatus;
            // Terminal swipes stamp an end time; defer/shuffle don't
            if (newStatus === 'complete' || newStatus === 'skipped') {
              base.endedAt = now;
            }
          }
          return base;
        });

      const now = Date.now();

      switch (direction) {
        case 'right': {
          setStats((s) => ({ ...s, completed: s.completed + 1 }));
          const newIdx = currentIndex + 1;
          const isDone = newIdx >= cards.length;
          const updatedRun: DailyRun = {
            ...run,
            liveCardStates: rebuildRunStates(
              cards,
              currentCard.id,
              'complete',
              now
            ),
            status: isDone ? 'complete' : 'in-progress',
            updatedAt: now,
          };
          setRun(updatedRun);
          await saveDailyRun(updatedRun);
          await maybeAutoDeleteTutorial(isDone);
          setCurrentIndex(newIdx);
          if (!isDone) triggerFlipReveal();
          break;
        }
        case 'up': {
          setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
          const newIdx = currentIndex + 1;
          const isDone = newIdx >= cards.length;
          const updatedRun: DailyRun = {
            ...run,
            liveCardStates: rebuildRunStates(
              cards,
              currentCard.id,
              'skipped',
              now
            ),
            status: isDone ? 'complete' : 'in-progress',
            updatedAt: now,
          };
          setRun(updatedRun);
          await saveDailyRun(updatedRun);
          await maybeAutoDeleteTutorial(isDone);
          setCurrentIndex(newIdx);
          if (!isDone) triggerFlipReveal();
          break;
        }
        case 'left': {
          setStats((s) => ({ ...s, deferred: s.deferred + 1 }));
          // Compute new order
          const reordered = [...cards];
          const card = reordered[currentIndex];
          reordered.splice(currentIndex, 1);
          const insertPos = Math.min(currentIndex + 1, reordered.length);
          reordered.splice(insertPos, 0, card);
          // Persist new order AND reset startedAt on the deferred card so
          // its timer starts fresh when it reappears.
          const updatedRun: DailyRun = {
            ...run,
            liveCardStates: rebuildRunStates(
              reordered,
              currentCard.id,
              'pending',
              now
            ).map((s) =>
              s.cardId === currentCard.id
                ? { ...s, startedAt: undefined, endedAt: undefined }
                : s
            ),
            updatedAt: now,
          };
          setCards(reordered);
          setRun(updatedRun);
          await saveDailyRun(updatedRun);
          triggerFlipReveal();
          break;
        }
        case 'down': {
          setStats((s) => ({ ...s, shuffled: s.shuffled + 1 }));
          // Send card to the bottom of the deck (last position).
          const reordered = [...cards];
          const card = reordered[currentIndex];
          reordered.splice(currentIndex, 1);
          reordered.push(card);
          const updatedRun: DailyRun = {
            ...run,
            liveCardStates: rebuildRunStates(
              reordered,
              currentCard.id,
              'pending',
              now
            ).map((s) =>
              s.cardId === currentCard.id
                ? { ...s, startedAt: undefined, endedAt: undefined }
                : s
            ),
            updatedAt: now,
          };
          setCards(reordered);
          setRun(updatedRun);
          await saveDailyRun(updatedRun);
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
      stats,
      date,
      deckId,
      triggerFlipReveal,
      triggerShuffleJitter,
    ]
  );

  // Undo the last swipe
  const handleUndo = useCallback(async () => {
    if (!undoSnapshot || !run) return;
    // Remove the log entry
    await deleteLog(undoSnapshot.logId);
    // Restore state
    setCards(undoSnapshot.cards);
    setCurrentIndex(undoSnapshot.currentIndex);
    setStats(undoSnapshot.stats);
    const restoredRun: DailyRun = {
      ...run,
      liveCardStates: undoSnapshot.runLiveStates,
      status: undoSnapshot.runStatus,
      updatedAt: Date.now(),
    };
    setRun(restoredRun);
    await saveDailyRun(restoredRun);
    setUndoSnapshot(null);
    totalSwiped.current = Math.max(0, totalSwiped.current - 1);
    triggerFlipReveal();
  }, [undoSnapshot, run, triggerFlipReveal]);

  // Stamp startedAt on whatever card is currently on top. Runs when the
  // current card changes (after swipes, reorders, or initial load) and
  // only writes if the card's startedAt hasn't already been set.
  useEffect(() => {
    if (!run || paused) return;
    const currentCard = cards[currentIndex];
    if (!currentCard) return;
    const idx = run.liveCardStates.findIndex(
      (s) => s.cardId === currentCard.id
    );
    if (idx < 0) return;
    const state = run.liveCardStates[idx];
    if (state.startedAt || state.status !== 'pending') return;
    const updatedStates = [...run.liveCardStates];
    updatedStates[idx] = { ...state, startedAt: Date.now() };
    const updated: DailyRun = {
      ...run,
      liveCardStates: updatedStates,
      updatedAt: Date.now(),
    };
    setRun(updated);
    saveDailyRun(updated);
  }, [cards, currentIndex, run, paused]);

  // Long-press the current card → jump to its editor. Returning here will
  // refresh the card data (see the focus listener below).
  const handleLongPressEdit = useCallback(() => {
    const currentCard = cards[currentIndex];
    if (!currentCard) return;
    navigation.navigate('CardEditor', {
      cardId: currentCard.id,
      deckId,
    });
  }, [cards, currentIndex, deckId, navigation]);

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
      // Cmd/Ctrl+Z → undo (works even when paused)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
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
        case 'e':
          e.preventDefault();
          handleLongPressEdit();
          break;
        case 'Escape':
          e.preventDefault();
          navigation.goBack();
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [paused, currentIndex, cards.length, handleSwipe, handleLongPressEdit, handleUndo, navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color.link} />
      </View>
    );
  }

  const remainingCards = cards.slice(currentIndex);
  const currentCard = remainingCards[0];
  const isDeckComplete = currentIndex >= cards.length && !paused;

  // Paused
  if (paused) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.pausedContainer}>
          <View style={styles.pausedIconWrap}>
            <PauseIcon size={48} color={color.fg2} strokeWidth={1.5} />
          </View>
          <Text style={styles.pausedTitle}>Deck Paused</Text>
          <Text style={styles.pausedSubtitle}>
            {cards.length - currentIndex} of {cards.length} cards remaining
          </Text>
          <Pressable style={styles.resumeButton} onPress={handleResume}>
            <PlayIcon size={18} color="#fff" strokeWidth={2.2} />
            <Text style={styles.btnText}>Resume</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryText}>Back to Deck</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // Complete
  if (isDeckComplete) {
    return (
      <ScreenContainer style={styles.container}>
        <DeckComplete
          stats={{ total: totalSwiped.current, ...stats }}
          nextDeckName={nextDeck?.name}
          onPlayNext={
            nextDeck
              ? async () => {
                  // Create or resume a run for the next deck
                  const today = todayString();
                  let run = await getDailyRun(nextDeck.id, today);
                  if (!run) {
                    let orderedIds = nextDeck.cardRefs
                      .sort(
                        (a, b) => a.positionInDeck - b.positionInDeck
                      )
                      .map((r) => r.cardId);
                    if (nextDeck.orderMode === 'random') {
                      for (let i = orderedIds.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [orderedIds[i], orderedIds[j]] = [
                          orderedIds[j],
                          orderedIds[i],
                        ];
                      }
                    }
                    run = {
                      date: today,
                      deckId: nextDeck.id,
                      liveCardStates: orderedIds.map((cardId, i) => ({
                        cardId,
                        status: 'pending' as const,
                        position: i,
                      })),
                      status: 'in-progress',
                      startedAt: Date.now(),
                      updatedAt: Date.now(),
                    };
                    await saveDailyRun(run);
                  }
                  navigation.replace('Play', {
                    deckId: nextDeck.id,
                    date: today,
                  });
                }
              : undefined
          }
          onBackToList={() => navigation.navigate('DeckList')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <ChevronLeftIcon size={24} color={color.linkOnFelt} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{deckName}</Text>
        <Text style={styles.counter}>
          {currentIndex + 1} / {cards.length}
        </Text>
      </View>

      <View style={styles.cardArea}>
        <View style={styles.cardAnchor}>
          <CardStack
            cards={remainingCards}
            identities={remainingCards.map((c) =>
              identityFor(deckId, originalPositionByCardId[c.id] ?? 0)
            )}
            shuffleJitter={shuffleJitter}
          />
          {currentCard && (
            <SwipeableCard
              key={`${currentCard.id}-${currentIndex}`}
              card={currentCard}
              identity={identityFor(
                deckId,
                originalPositionByCardId[currentCard.id] ?? 0
              )}
              onSwipe={handleSwipe}
              onLongPress={handleLongPressEdit}
              flipProgress={flipProgress}
            />
          )}
        </View>
      </View>

      {/* Undo pill */}
      {undoSnapshot && (
        <Pressable style={styles.undoPill} onPress={handleUndo}>
          <UndoIcon size={14} color="#fff" strokeWidth={2.2} />
          <Text style={styles.undoText}>Undo</Text>
        </Pressable>
      )}

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bgPage, alignItems: 'center' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: color.bgPage,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[1],
  },
  backBtn: { paddingRight: space[2] },
  headerTitle: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fgOnFelt1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  counter: {
    fontFamily: font.mono,
    fontSize: fontSize.counter,
    fontWeight: fontWeight.medium,
    color: color.fgOnFelt2,
    fontVariant: ['tabular-nums'],
  },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  cardAnchor: { width: CARD_WIDTH, height: CARD_HEIGHT },
  hint: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fg4,
    paddingBottom: space[2],
    textAlign: 'center',
    paddingHorizontal: space[4],
  },
  undoPill: {
    position: 'absolute',
    bottom: space[7],
    alignSelf: 'center',
    backgroundColor: color.fg1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.full,
    ...shadow.lift,
  },
  undoText: {
    fontFamily: font.text,
    color: '#fff',
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
  },
  // Paused
  pausedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[7],
  },
  pausedIconWrap: { marginBottom: space[4] },
  pausedTitle: {
    fontFamily: font.display,
    fontSize: fontSize.displayL,
    fontWeight: fontWeight.regular,
    color: color.fgOnFelt1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    marginBottom: space[2],
  },
  pausedSubtitle: {
    fontFamily: font.text,
    fontSize: fontSize.body,
    color: color.fgOnFelt2,
    marginBottom: space[7],
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[7],
    paddingVertical: 14,
    backgroundColor: suit.heart,
    borderRadius: radius.xl,
    marginBottom: space[3],
    minWidth: 220,
    justifyContent: 'center',
    ...shadow.fab,
  },
  secondaryButton: {
    paddingHorizontal: space[7],
    paddingVertical: space[3],
    minWidth: 220,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: font.text,
    color: color.fgOnFelt2,
    fontSize: fontSize.ui,
    fontWeight: fontWeight.medium,
  },
  btnText: {
    fontFamily: font.text,
    color: '#fff',
    fontSize: fontSize.bodyL,
    fontWeight: fontWeight.semibold,
  },
});
