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
  todayString,
} from '../data/storage';

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
              onPress={() =>
                navigation.navigate('DeckDetail', { deckId: deck.id })
              }
            >
              <View style={styles.rowLeft}>
                <Text style={styles.deckName}>{deck.name}</Text>
                <Text style={styles.deckMeta}>
                  {deck.cardRefs.length} cards{' '}
                  {deck.orderMode === 'random' ? '\uD83D\uDD00' : '\u2630'}
                </Text>
              </View>
              <View style={styles.rowRight}>
                {runInfo && runInfo.status !== 'complete' && (
                  <Text style={styles.inProgress}>
                    {runInfo.done} of {runInfo.total}
                  </Text>
                )}
                {runInfo?.status === 'complete' && (
                  <Text style={styles.complete}>{'\u2713'}</Text>
                )}
                <Text style={styles.chevron}>{'\u203A'}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No decks yet. Tap + to create one.
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
  list: { paddingHorizontal: 16 },
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
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inProgress: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '600',
  },
  complete: { fontSize: 18, color: '#4CAF50', fontWeight: '700' },
  chevron: { fontSize: 22, color: '#ccc' },
  empty: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 60,
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
