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
import type { Goal, Card, CompletionLog } from '../data/types';
import {
  getAllGoals,
  saveGoal,
  deleteGoal,
  getAllCards,
  getAllLogs,
  todayString,
  generateId,
} from '../data/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Goals'>;

export default function GoalsScreen({ navigation }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [logs, setLogs] = useState<CompletionLog[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getAllGoals(), getAllCards(), getAllLogs()]).then(
        ([g, c, l]) => {
          setGoals(g);
          setCards(c);
          setLogs(l);
        }
      );
    }, [])
  );

  const today = todayString();

  const getGoalStats = (goal: Goal) => {
    // Check if all cards in goal were completed today
    const todayComplete = new Set(
      logs
        .filter((l) => l.date === today && l.status === 'complete')
        .map((l) => l.cardId)
    );
    const metToday = goal.cardIds.every((id) => todayComplete.has(id));

    // Current streak: consecutive days (backwards from today) where all cards complete
    const dateSet = new Map<string, Set<string>>();
    for (const log of logs) {
      if (log.status !== 'complete') continue;
      if (!dateSet.has(log.date)) dateSet.set(log.date, new Set());
      dateSet.get(log.date)!.add(log.cardId);
    }

    let streak = 0;
    let checkDate = new Date();
    while (true) {
      const dStr = checkDate.toISOString().slice(0, 10);
      const dayComplete = dateSet.get(dStr);
      if (dayComplete && goal.cardIds.every((id) => dayComplete.has(id))) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Longest streak
    const allDates = [...dateSet.keys()].sort();
    let longest = 0;
    let run = 0;
    let prev = '';
    for (const d of allDates) {
      const dayComplete = dateSet.get(d)!;
      if (goal.cardIds.every((id) => dayComplete.has(id))) {
        if (prev) {
          const prevD = new Date(prev);
          prevD.setDate(prevD.getDate() + 1);
          if (prevD.toISOString().slice(0, 10) === d) {
            run++;
          } else {
            run = 1;
          }
        } else {
          run = 1;
        }
        longest = Math.max(longest, run);
        prev = d;
      } else {
        run = 0;
        prev = '';
      }
    }

    // Completion rate: days with all complete / total days with any log
    const uniqueDates = [...new Set(logs.map((l) => l.date))];
    const daysComplete = uniqueDates.filter((d) => {
      const dayLogs = dateSet.get(d);
      return dayLogs && goal.cardIds.every((id) => dayLogs.has(id));
    }).length;
    const rate = uniqueDates.length > 0
      ? Math.round((daysComplete / uniqueDates.length) * 100)
      : 0;

    return { metToday, streak, longest, rate };
  };

  const handleCreate = async () => {
    if (!newName.trim() || selectedCardIds.length === 0) return;
    const goal: Goal = {
      id: generateId(),
      name: newName.trim(),
      cardIds: selectedCardIds,
      successRule: 'all-complete-daily',
      createdAt: Date.now(),
    };
    await saveGoal(goal);
    setGoals([...goals, goal]);
    setNewName('');
    setSelectedCardIds([]);
    setShowCreate(false);
  };

  const handleDelete = async (goal: Goal) => {
    const confirmed = window.confirm(`Delete "${goal.name}"?`);
    if (!confirmed) return;
    await deleteGoal(goal.id);
    setGoals(goals.filter((g) => g.id !== goal.id));
  };

  const toggleCard = (cardId: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'\u2039'} Back</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Goals</Text>

      <FlatList
        data={goals}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          goals.length === 0 && !showCreate ? (
            <Text style={styles.empty}>
              No goals yet. Create one to track streaks.
            </Text>
          ) : null
        }
        renderItem={({ item: goal }) => {
          const s = getGoalStats(goal);
          return (
            <Pressable
              style={styles.goalCard}
              onLongPress={() => handleDelete(goal)}
            >
              <View style={styles.goalHeader}>
                <Text style={styles.goalName}>{goal.name}</Text>
                {s.metToday && <Text style={styles.metBadge}>{'\u2713'} Today</Text>}
              </View>
              <View style={styles.goalStats}>
                <View style={styles.goalStat}>
                  <Text style={styles.goalStatVal}>{s.streak}d</Text>
                  <Text style={styles.goalStatLabel}>Streak</Text>
                </View>
                <View style={styles.goalStat}>
                  <Text style={styles.goalStatVal}>{s.longest}d</Text>
                  <Text style={styles.goalStatLabel}>Best</Text>
                </View>
                <View style={styles.goalStat}>
                  <Text style={styles.goalStatVal}>{s.rate}%</Text>
                  <Text style={styles.goalStatLabel}>Rate</Text>
                </View>
              </View>
              <Text style={styles.goalCards}>
                {goal.cardIds.length} card{goal.cardIds.length !== 1 ? 's' : ''}{' '}
                {'\u2022'} Long-press to delete
              </Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <>
            {showCreate && (
              <View style={styles.createForm}>
                <TextInput
                  style={styles.nameInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Goal name"
                  placeholderTextColor="#bbb"
                  autoFocus
                />
                <Text style={styles.pickLabel}>
                  Pick cards ({selectedCardIds.length} selected)
                </Text>
                {cards.map((card) => (
                  <Pressable
                    key={card.id}
                    style={[
                      styles.pickRow,
                      selectedCardIds.includes(card.id) && styles.pickRowActive,
                    ]}
                    onPress={() => toggleCard(card.id)}
                  >
                    <Text style={styles.pickCheck}>
                      {selectedCardIds.includes(card.id) ? '\u2611' : '\u2610'}
                    </Text>
                    <Text style={styles.pickTitle} numberOfLines={1}>
                      {card.title}
                    </Text>
                  </Pressable>
                ))}
                <View style={styles.createActions}>
                  <Pressable onPress={() => setShowCreate(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.saveBtn,
                      (!newName.trim() || selectedCardIds.length === 0) &&
                        styles.saveBtnDisabled,
                    ]}
                    onPress={handleCreate}
                  >
                    <Text style={styles.saveText}>Create Goal</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {!showCreate && (
              <Pressable
                style={styles.addBtn}
                onPress={() => setShowCreate(true)}
              >
                <Text style={styles.addBtnText}>+ New Goal</Text>
              </Pressable>
            )}
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0EB' },
  headerRow: { paddingHorizontal: 20, paddingTop: 56 },
  back: { fontSize: 17, color: '#4A90D9' },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  list: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#999', fontSize: 16, marginTop: 40 },
  goalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalName: { fontSize: 18, fontWeight: '600', color: '#222' },
  metBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  goalStats: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  goalStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8F5F1',
    borderRadius: 8,
    padding: 10,
  },
  goalStatVal: { fontSize: 20, fontWeight: '700', color: '#333' },
  goalStatLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  goalCards: { fontSize: 12, color: '#aaa' },
  // Create form
  createForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  nameInput: {
    fontSize: 17,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    color: '#222',
    marginBottom: 12,
  },
  pickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  pickRowActive: { backgroundColor: '#E8F0FE' },
  pickCheck: { fontSize: 18, color: '#4A90D9' },
  pickTitle: { flex: 1, fontSize: 15, color: '#333' },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  cancelText: { fontSize: 15, color: '#888' },
  saveBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  addBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBtnText: { fontSize: 15, color: '#4A90D9', fontWeight: '600' },
});
