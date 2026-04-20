import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
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
  saveCard,
  generateId,
  todayString,
} from '../data/storage';
import {
  requestNotificationPermission,
  scheduleTrigger,
  cancelTrigger,
} from '../data/notifications';
import TimeInput from '../components/TimeInput';
import ScreenContainer from '../components/ScreenContainer';
import CardComposer, { type CardState } from '../components/CardComposer';
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
  signal,
} from '../design/tokens';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CheckIcon,
  SkipIcon,
  DeferIcon,
  ShuffleIcon,
  FixedOrderIcon,
  RandomOrderIcon,
  PlayIcon,
  PlusIcon,
  SkipIcon as XIcon,
  TimerIcon,
} from '../design/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckDetail'>;

export default function DeckDetailScreen({ route, navigation }: Props) {
  const { deckId } = route.params;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [todayRun, setTodayRun] = useState<DailyRun | null>(null);
  const [loading, setLoading] = useState(true);

  // Inline card composer state
  const emptyComposer: CardState = {
    title: '',
    blocks: [],
    timerSeconds: undefined,
    link: undefined,
  };
  const [composer, setComposer] = useState<CardState>(emptyComposer);

  const reload = useCallback(async () => {
    const [d, allCards] = await Promise.all([getDeck(deckId), getAllCards()]);
    if (!d) {
      navigation.goBack();
      return;
    }
    setDeck(d);
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

    const refs = [...deck.cardRefs].sort(
      (a, b) => a.positionInDeck - b.positionInDeck
    );
    [refs[fromIndex], refs[toIndex]] = [refs[toIndex], refs[fromIndex]];
    refs.forEach((r, i) => (r.positionInDeck = i));

    const updated = { ...deck, cardRefs: refs };
    await saveDeck(updated);
    setDeck(updated);

    const allCards = await getAllCards();
    const ordered = refs
      .map((ref) => allCards.find((c) => c.id === ref.cardId))
      .filter(Boolean) as Card[];
    setCards(ordered);
  };

  const addComposerCard = async () => {
    if (!deck || !composer.title.trim()) return;
    const newCard: Card = {
      id: generateId(),
      title: composer.title.trim(),
      content: composer.blocks.filter((b) => b.value.trim().length > 0),
      timer:
        composer.timerSeconds != null && composer.timerSeconds > 0
          ? { durationSeconds: composer.timerSeconds }
          : undefined,
      link: composer.link?.trim() ? composer.link.trim() : undefined,
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
    setDeck(updated);
    setCards((prev) => [...prev, newCard]);
    setComposer(emptyComposer);
  };

  const startOrResume = async () => {
    if (!deck) return;
    const today = todayString();
    let run = await getDailyRun(deck.id, today);

    if (!run) {
      let orderedIds = deck.cardRefs
        .sort((a, b) => a.positionInDeck - b.positionInDeck)
        .map((r) => r.cardId);

      if (deck.orderMode === 'random') {
        for (let i = orderedIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [orderedIds[i], orderedIds[j]] = [orderedIds[j], orderedIds[i]];
        }
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
          const swapIdx =
            1 + Math.floor(Math.random() * (orderedIds.length - 1));
          [orderedIds[0], orderedIds[swapIdx]] = [
            orderedIds[swapIdx],
            orderedIds[0],
          ];
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

  const handleDelete = async () => {
    const confirmed = window.confirm(`Delete "${deck?.name}"?`);
    if (!confirmed) return;
    await deleteDeck(deckId);
    navigation.goBack();
  };

  const renderStatusIcon = (cardId: string) => {
    if (!todayRun) return null;
    const state = todayRun.liveCardStates.find((s) => s.cardId === cardId);
    if (!state || state.status === 'pending') return null;
    switch (state.status) {
      case 'complete':
        return <CheckIcon size={16} color={suit.heart} strokeWidth={2.2} />;
      case 'skipped':
        return <SkipIcon size={16} color={suit.spade} strokeWidth={2.2} />;
      case 'deferred':
        return <DeferIcon size={16} color={suit.diamond} strokeWidth={2.2} />;
      case 'shuffled':
        return <ShuffleIcon size={16} color={suit.club} strokeWidth={2.2} />;
    }
  };

  if (loading || !deck) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color.link} />
      </View>
    );
  }

  const runLabel =
    todayRun?.status === 'paused'
      ? 'Resume'
      : todayRun?.status === 'in-progress'
      ? 'Continue'
      : 'Play';

  const OrderIcon =
    deck.orderMode === 'random' ? RandomOrderIcon : FixedOrderIcon;

  return (
    <ScreenContainer>
      {/* Fixed header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <ChevronLeftIcon size={22} color={color.link} strokeWidth={2.2} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Pressable onPress={handleDelete}>
          <Text style={styles.deleteBtn}>Delete</Text>
        </Pressable>
      </View>

      {/* Scrollable content — everything else lives here */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <Text style={styles.title}>{deck.name}</Text>

        {/* Order mode toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelRow}>
            <OrderIcon size={18} color={color.fg2} />
            <Text style={styles.toggleLabel}>
              {deck.orderMode === 'fixed' ? 'Fixed order' : 'Random order'}
            </Text>
          </View>
          <Switch
            value={deck.orderMode === 'random'}
            onValueChange={toggleOrderMode}
            trackColor={{ true: suit.heart, false: color.hairline }}
            thumbColor="#fff"
          />
        </View>

        {/* Trigger time */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelRow}>
            <TimerIcon size={18} color={color.fg2} />
            <Text style={styles.toggleLabel}>
              {deck.trigger?.time
                ? `Trigger at ${deck.trigger.time}`
                : 'Daily trigger'}
            </Text>
          </View>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <TimeInput
              value={deck.trigger?.time ?? ''}
              onChange={async (v) => {
                if (!deck) return;
                const updated = {
                  ...deck,
                  trigger: v ? { time: v } : undefined,
                };
                await saveDeck(updated);
                setDeck(updated);

                if (v && /^\d{2}:\d{2}$/.test(v)) {
                  const granted = await requestNotificationPermission();
                  if (granted) {
                    scheduleTrigger(updated);
                  }
                } else {
                  cancelTrigger(deck.id);
                }
              }}
            />
            {deck.trigger?.time && (
              <Pressable
                onPress={async () => {
                  const updated = { ...deck, trigger: undefined };
                  await saveDeck(updated);
                  setDeck(updated);
                  cancelTrigger(deck.id);
                }}
                hitSlop={8}
              >
                <XIcon size={18} color={color.fg4} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Inline WYSIWYG composer — the editor IS the card */}
        <View style={styles.composerWrap}>
          <CardComposer
            state={composer}
            onChange={setComposer}
            size="inline"
          />
          <View style={styles.composerActions}>
            <Pressable
              style={styles.libraryBtn}
              onPress={() =>
                navigation.navigate('CardPicker', { deckId: deck.id })
              }
            >
              <Text style={styles.libraryBtnText}>From library</Text>
            </Pressable>
            <Pressable
              style={[
                styles.addToDeckBtn,
                !composer.title.trim() && styles.addToDeckBtnDisabled,
              ]}
              onPress={addComposerCard}
              disabled={!composer.title.trim()}
            >
              <PlusIcon size={16} color="#fff" strokeWidth={2.2} />
              <Text style={styles.addToDeckText}>Add to deck</Text>
            </Pressable>
          </View>
        </View>

        {/* Card list — rendered inline inside the scroll view */}
        <Text style={styles.sectionTitle}>Cards ({cards.length})</Text>
        <View style={styles.list}>
          {cards.map((card, index) => (
            <Pressable
              key={card.id}
              style={styles.cardRow}
              onPress={() =>
                navigation.navigate('CardEditor', {
                  cardId: card.id,
                  deckId: deck.id,
                })
              }
            >
              {deck.orderMode === 'fixed' ? (
                <View style={styles.reorderBtns}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      moveCard(index, 'up');
                    }}
                    disabled={index === 0}
                    hitSlop={4}
                  >
                    <ChevronUpIcon
                      size={14}
                      color={index === 0 ? color.fgDisabled : color.link}
                      strokeWidth={2.2}
                    />
                  </Pressable>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      moveCard(index, 'down');
                    }}
                    disabled={index === cards.length - 1}
                    hitSlop={4}
                  >
                    <ChevronDownIcon
                      size={14}
                      color={
                        index === cards.length - 1
                          ? color.fgDisabled
                          : color.link
                      }
                      strokeWidth={2.2}
                    />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.cardIndex}>{index + 1}</Text>
              )}
              <Text style={styles.cardTitle} numberOfLines={1}>
                {card.title}
              </Text>
              {card.timer && (
                <View style={styles.timerBadge}>
                  <TimerIcon size={11} color={suit.club} strokeWidth={2.2} />
                  <Text style={styles.timerBadgeText}>
                    {card.timer.durationSeconds}s
                  </Text>
                </View>
              )}
              <View style={styles.statusIcon}>
                {renderStatusIcon(card.id)}
              </View>
              <ChevronRightIcon size={16} color={color.fg4} />
            </Pressable>
          ))}
        </View>

        {/* Resume / Play — scrolls with the content */}
        {cards.length > 0 && (
          <Pressable style={styles.resumeBottom} onPress={startOrResume}>
            <PlayIcon size={18} color="#fff" strokeWidth={2.2} />
            <Text style={styles.resumeBottomText}>{runLabel}</Text>
          </Pressable>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bgPage },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: color.bgPage,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: space[8] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[9],
    paddingBottom: space[2],
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.link,
  },
  deleteBtn: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: suit.heart,
  },
  title: {
    fontFamily: font.display,
    fontSize: fontSize.displayM,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[5],
    paddingVertical: space[2],
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  toggleLabel: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.fg2,
  },
  composerWrap: {
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  composerActions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[3],
    justifyContent: 'center',
  },
  libraryBtn: {
    paddingHorizontal: space[4],
    paddingVertical: space[2] + 2,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.bgRaised,
  },
  libraryBtnText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.link,
    fontWeight: fontWeight.medium,
  },
  addToDeckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[4],
    paddingVertical: space[2] + 2,
    borderRadius: radius.m,
    backgroundColor: suit.heart,
  },
  addToDeckBtnDisabled: { opacity: 0.4 },
  addToDeckText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: '#fff',
    fontWeight: fontWeight.semibold,
  },
  resumeBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    marginHorizontal: space[5],
    marginTop: space[3],
    marginBottom: space[5],
    backgroundColor: color.fg1,
    borderRadius: radius.m,
    paddingVertical: 14,
  },
  resumeBottomText: {
    fontFamily: font.text,
    color: '#fff',
    fontSize: fontSize.bodyL,
    fontWeight: fontWeight.semibold,
  },
  sectionTitle: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fg3,
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[2],
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
  },
  list: { paddingHorizontal: space[4] },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3] + 2,
    marginBottom: space[1] + 2,
    borderWidth: 1,
    borderColor: color.cardStroke,
    gap: space[2] + 2,
  },
  cardIndex: {
    fontFamily: font.mono,
    fontSize: fontSize.bodyS,
    fontWeight: fontWeight.medium,
    color: color.fg4,
    width: 20,
    textAlign: 'center',
  },
  reorderBtns: {
    flexDirection: 'column',
    gap: 2,
    width: 20,
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.fg1,
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
  statusIcon: { width: 20, alignItems: 'center' },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1] + 2,
    margin: space[4],
    padding: space[3] + 2,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: color.hairline,
    borderStyle: 'dashed',
  },
  addCardText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.link,
    fontWeight: fontWeight.semibold,
  },
});
