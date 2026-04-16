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

  // Tap deck → go straight to Play (create run if needed)
  const playDeck = async (deck: Deck) => {
    if (deck.cardRefs.length === 0) {
      // No cards — go to detail instead
      navigation.navigate('DeckDetail', { deckId: deck.id });
      return;
    }

    let run = await getDailyRun(deck.id, today);
    if (run?.status === 'complete') {
      // Already completed today — go to detail
      navigation.navigate('DeckDetail', { deckId: deck.id });
      return;
    }

    if (!run) {
      // Create new run
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
    const deck = await createDeckFromTemplate(tmpl);
    const allDecks = await getAllDecks();
    setDecks(allDecks);
  };

  // Which templates haven't been added yet (by name match)
  const existingNames = new Set(decks.map((d) => d.name));
  const availableTemplates = DECK_TEMPLATES.filter(
    (t) => !existingNames.has(t.name)
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Your Decks</Text>
        <View style={styles.topActions}>
          <Pressable onPress={() => navigation.navigate('Stats')}>
            <Text style={styles.topLink}>Stats</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.topLink}>{'\u2699'}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={decks}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: deck }) => {
          const runInfo = getRunInfo(deck.id);
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
                <Text style={styles.deckMeta}>
                  {deck.cardRefs.length} cards{' '}
                  {deck.orderMode === 'random' ? '\uD83D\uDD00' : '\u2630'}
                  {'  '}
                  <Text style={styles.editHint}>hold to edit</Text>
                </Text>
              </View>
              <View style={styles.rowRight}>
                {runInfo && runInfo.status !== 'complete' && (
                  <Text style={styles.inProgress}>
                    {runInfo.done}/{runInfo.total}
                  </Text>
                )}
                {runInfo?.status === 'complete' && (
                  <Text style={styles.complete}>{'\u2713'}</Text>
                )}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <>
            {/* Template decks available to add */}
            {availableTemplates.length > 0 && (
              <View style={styles.templateSection}>
                <Text style={styles.templateHeading}>Add a template</Text>
                {availableTemplates.map((tmpl) => (
                  <Pressable
                    key={tmpl.name}
                    style={styles.templateRow}
                    onPress={() => addTemplate(tmpl.name)}
                  >
                    <View style={styles.rowLeft}>
                      <Text style={styles.templateName}>{tmpl.name}</Text>
                      <Text style={styles.templateMeta}>
                        {tmpl.cards.length} cards {'\u2022'}{' '}
                        {tmpl.orderMode === 'random' ? 'Random' : 'Fixed'}
                      </Text>
                    </View>
                    <Text style={styles.addBtn}>+ Add</Text>
                  </Pressable>
                ))}
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
        <Text style={styles.fabText}>+</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
  },
  topActions: { flexDirection: 'row', gap: 16, paddingBottom: 4 },
  topLink: { fontSize: 16, color: '#4A90D9', fontWeight: '500' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.08)',
  },
  rowLeft: { flex: 1 },
  deckName: { fontSize: 17, fontWeight: '600', color: '#222' },
  deckMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  editHint: { fontSize: 11, color: '#bbb', fontStyle: 'italic' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inProgress: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '600',
  },
  complete: { fontSize: 18, color: '#4CAF50', fontWeight: '700' },
  empty: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
  // Template section
  templateSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e0db',
  },
  templateHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e0db',
    borderStyle: 'dashed',
  },
  templateName: { fontSize: 16, fontWeight: '600', color: '#555' },
  templateMeta: { fontSize: 12, color: '#aaa', marginTop: 2 },
  addBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90D9',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px 12px rgba(0,0,0,0.2)',
  },
  fabText: { fontSize: 28, color: '#fff', marginTop: -2 },
});
