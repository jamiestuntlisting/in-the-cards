import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import type { Deck, DailyRun } from '../data/types';
import {
  getAllDecks,
  getAllDailyRuns,
  getDailyRun,
  saveDailyRun,
  todayString,
} from '../data/storage';
import {
  DECK_TEMPLATES,
  createDeckFromTemplate,
} from '../data/seedData';
import ScreenContainer from '../components/ScreenContainer';
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
  PlusIcon,
  SettingsIcon,
  CheckIcon,
  FixedOrderIcon,
  RandomOrderIcon,
} from '../design/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckList'>;

export default function DeckListScreen({ navigation }: Props) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [runs, setRuns] = useState<DailyRun[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [d, r] = await Promise.all([getAllDecks(), getAllDailyRuns()]);
        setDecks(d);
        setRuns(r);
        setLoading(false);
      })();
    }, [])
  );

  const today = todayString();

  const getRunInfo = (deckId: string) => {
    const run = runs.find((r) => r.deckId === deckId && r.date === today);
    if (!run) return null;
    const done = run.liveCardStates.filter(
      (s) => s.status === 'complete' || s.status === 'skipped'
    ).length;
    return { status: run.status, done, total: run.liveCardStates.length };
  };

  const playDeck = async (deck: Deck) => {
    if (deck.cardRefs.length === 0) {
      navigation.navigate('DeckDetail', { deckId: deck.id });
      return;
    }

    let run = await getDailyRun(deck.id, today);
    if (run?.status === 'complete') {
      navigation.navigate('DeckDetail', { deckId: deck.id });
      return;
    }

    if (!run) {
      let orderedIds = deck.cardRefs
        .sort((a, b) => a.positionInDeck - b.positionInDeck)
        .map((r) => r.cardId);

      if (deck.orderMode === 'random') {
        for (let i = orderedIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [orderedIds[i], orderedIds[j]] = [orderedIds[j], orderedIds[i]];
        }
      }

      run = {
        date: today,
        deckId: deck.id,
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
    } else if (run.status === 'paused') {
      run.status = 'in-progress';
      run.updatedAt = Date.now();
      await saveDailyRun(run);
    }

    navigation.navigate('Play', { deckId: deck.id, date: today });
  };

  const addTemplate = async (tmplName: string) => {
    const tmpl = DECK_TEMPLATES.find((t) => t.name === tmplName);
    if (!tmpl) return;
    await createDeckFromTemplate(tmpl);
    const allDecks = await getAllDecks();
    setDecks(allDecks);
  };

  const existingNames = new Set(decks.map((d) => d.name));
  const availableTemplates = DECK_TEMPLATES.filter(
    (t) => !existingNames.has(t.name)
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color.link} />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Your Decks</Text>
        <View style={styles.topActions}>
          <Pressable onPress={() => navigation.navigate('Stats')}>
            <Text style={styles.topLink}>Stats</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
            <SettingsIcon size={22} color={color.link} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={decks}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: deck }) => {
          const runInfo = getRunInfo(deck.id);
          const OrderIcon =
            deck.orderMode === 'random' ? RandomOrderIcon : FixedOrderIcon;
          return (
            <Pressable
              style={styles.row}
              onPress={() => playDeck(deck)}
              onLongPress={() =>
                navigation.navigate('DeckDetail', { deckId: deck.id })
              }
            >
              <View style={styles.rowLeft}>
                <Text style={styles.deckName}>{deck.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.deckMeta}>
                    {deck.cardRefs.length} cards
                  </Text>
                  <OrderIcon size={14} color={color.fg3} />
                  <Text style={styles.editHint}>hold to edit</Text>
                </View>
              </View>
              <View style={styles.rowRight}>
                {runInfo && runInfo.status !== 'complete' && (
                  <Text style={styles.inProgress}>
                    {runInfo.done}/{runInfo.total}
                  </Text>
                )}
                {runInfo?.status === 'complete' && (
                  <CheckIcon size={20} color={suit.heart} strokeWidth={2.2} />
                )}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <>
            {availableTemplates.length > 0 && (
              <View style={styles.templateSection}>
                <Text style={styles.templateHeading}>Add a template</Text>
                {availableTemplates.map((tmpl) => {
                  const OrderIcon =
                    tmpl.orderMode === 'random'
                      ? RandomOrderIcon
                      : FixedOrderIcon;
                  return (
                    <Pressable
                      key={tmpl.name}
                      style={styles.templateRow}
                      onPress={() => addTemplate(tmpl.name)}
                    >
                      <View style={styles.rowLeft}>
                        <Text style={styles.templateName}>{tmpl.name}</Text>
                        <View style={styles.metaRow}>
                          <Text style={styles.templateMeta}>
                            {tmpl.cards.length} cards
                          </Text>
                          <OrderIcon size={13} color={color.fg4} />
                          <Text style={styles.templateMeta}>
                            {tmpl.orderMode === 'random' ? 'Random' : 'Fixed'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.addBtnRow}>
                        <PlusIcon size={14} color={color.link} strokeWidth={2.2} />
                        <Text style={styles.addBtn}>Add</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No decks yet. Add a template or tap + to create one.
          </Text>
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('NewDeck')}
      >
        <PlusIcon size={28} color="#fff" strokeWidth={2.2} />
      </Pressable>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space[5],
    paddingTop: space[9],
    paddingBottom: space[3],
  },
  heading: {
    fontFamily: font.display,
    fontSize: fontSize.displayM,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  topActions: {
    flexDirection: 'row',
    gap: space[4],
    alignItems: 'center',
    paddingBottom: space[1],
  },
  topLink: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.link,
    fontWeight: fontWeight.medium,
  },
  list: { paddingHorizontal: space[4], paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    padding: space[4],
    marginBottom: space[2] + 2,
    borderWidth: 1,
    borderColor: color.cardStroke,
    ...shadow.card,
  },
  rowLeft: { flex: 1 },
  deckName: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[1] + 2,
  },
  deckMeta: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg3,
  },
  editHint: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fg4,
    fontStyle: 'italic',
    marginLeft: space[2],
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  inProgress: {
    fontFamily: font.mono,
    fontSize: fontSize.bodyS,
    color: suit.diamond,
    fontWeight: fontWeight.semibold,
  },
  empty: {
    textAlign: 'center',
    color: color.fg4,
    fontSize: fontSize.body,
    marginTop: space[8],
    fontFamily: font.text,
  },
  // Template section
  templateSection: {
    marginTop: space[5],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  templateHeading: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fg3,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginBottom: space[3],
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bgSurface,
    borderRadius: radius.l,
    padding: space[3] + 2,
    marginBottom: space[2],
    borderWidth: 1,
    borderColor: color.hairline,
    borderStyle: 'dashed',
  },
  templateName: {
    fontFamily: font.display,
    fontSize: fontSize.bodyL,
    fontWeight: fontWeight.regular,
    color: color.fg2,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  templateMeta: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg4,
  },
  addBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtn: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    fontWeight: fontWeight.semibold,
    color: color.link,
  },
  fab: {
    position: 'absolute',
    bottom: space[7],
    right: space[6],
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: suit.heart,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.fab,
  },
});
