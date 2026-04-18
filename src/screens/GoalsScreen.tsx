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
import {
  ChevronLeftIcon,
  CheckIcon,
  PlusIcon,
} from '../design/icons';

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
    const todayComplete = new Set(
      logs
        .filter((l) => l.date === today && l.status === 'complete')
        .map((l) => l.cardId)
    );
    const metToday = goal.cardIds.every((id) => todayComplete.has(id));

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

    const uniqueDates = [...new Set(logs.map((l) => l.date))];
    const daysComplete = uniqueDates.filter((d) => {
      const dayLogs = dateSet.get(d);
      return dayLogs && goal.cardIds.every((id) => dayLogs.has(id));
    }).length;
    const rate =
      uniqueDates.length > 0
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
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <ChevronLeftIcon size={22} color={color.link} strokeWidth={2.2} />
          <Text style={styles.backText}>Back</Text>
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
                {s.metToday && (
                  <View style={styles.metBadge}>
                    <CheckIcon size={12} color={suit.heart} strokeWidth={2.2} />
                    <Text style={styles.metBadgeText}>Today</Text>
                  </View>
                )}
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
                {goal.cardIds.length} card
                {goal.cardIds.length !== 1 ? 's' : ''} {'\u2022'} Long-press to delete
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
                  placeholderTextColor={color.fg4}
                  autoFocus
                />
                <Text style={styles.pickLabel}>
                  Pick cards ({selectedCardIds.length} selected)
                </Text>
                {cards.map((card) => {
                  const selected = selectedCardIds.includes(card.id);
                  return (
                    <Pressable
                      key={card.id}
                      style={[
                        styles.pickRow,
                        selected && styles.pickRowActive,
                      ]}
                      onPress={() => toggleCard(card.id)}
                    >
                      <View
                        style={[
                          styles.pickCheck,
                          selected && styles.pickCheckActive,
                        ]}
                      >
                        {selected && (
                          <CheckIcon
                            size={12}
                            color="#fff"
                            strokeWidth={2.5}
                          />
                        )}
                      </View>
                      <Text style={styles.pickTitle} numberOfLines={1}>
                        {card.title}
                      </Text>
                    </Pressable>
                  );
                })}
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
                style={styles.addBtnRow}
                onPress={() => setShowCreate(true)}
              >
                <PlusIcon size={16} color={color.link} strokeWidth={2.2} />
                <Text style={styles.addBtnText}>New Goal</Text>
              </Pressable>
            )}
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bgPage },
  headerRow: { paddingHorizontal: space[5], paddingTop: space[9] },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.link,
  },
  heading: {
    fontFamily: font.display,
    fontSize: fontSize.displayM,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
  },
  list: { padding: space[4], paddingBottom: space[9] },
  empty: {
    fontFamily: font.text,
    textAlign: 'center',
    color: color.fg4,
    fontSize: fontSize.body,
    marginTop: space[8],
  },
  goalCard: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    padding: space[4],
    marginBottom: space[3],
    borderWidth: 1,
    borderColor: color.cardStroke,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[3] - 2,
  },
  goalName: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  metBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: suitTint.heart,
    paddingHorizontal: space[2] + 2,
    paddingVertical: 3,
    borderRadius: radius.s,
  },
  metBadgeText: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: suit.heart,
  },
  goalStats: {
    flexDirection: 'row',
    gap: space[3] - 2,
    marginBottom: space[2],
  },
  goalStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: color.bgSunken,
    borderRadius: radius.s,
    padding: space[3] - 2,
  },
  goalStatVal: {
    fontFamily: font.mono,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.semibold,
    color: color.fg1,
  },
  goalStatLabel: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fg4,
    marginTop: 2,
  },
  goalCards: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fg4,
  },
  // Create form
  createForm: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    padding: space[4],
    marginBottom: space[3],
    borderWidth: 1,
    borderColor: color.hairline,
  },
  nameInput: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    padding: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    marginBottom: space[3],
  },
  pickLabel: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fg3,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginBottom: space[2],
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[2] + 2,
    borderRadius: radius.s,
    gap: space[2],
  },
  pickRowActive: { backgroundColor: suitTint.heart },
  pickCheck: {
    width: 18,
    height: 18,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: color.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickCheckActive: {
    backgroundColor: suit.heart,
    borderColor: suit.heart,
  },
  pickTitle: {
    flex: 1,
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.fg1,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space[3],
  },
  cancelText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.fg3,
  },
  saveBtn: {
    backgroundColor: suit.heart,
    borderRadius: radius.m,
    paddingHorizontal: space[5],
    paddingVertical: space[2] + 2,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: {
    fontFamily: font.text,
    color: '#fff',
    fontSize: fontSize.ui,
    fontWeight: fontWeight.semibold,
  },
  addBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 14,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: color.hairline,
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.link,
    fontWeight: fontWeight.semibold,
  },
});
