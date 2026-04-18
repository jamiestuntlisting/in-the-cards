import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import type { CompletionLog, Card, Deck, Settings } from '../data/types';
import {
  getAllLogs,
  getAllCards,
  getAllDecks,
  getSettings,
  todayString,
} from '../data/storage';
import {
  computeSummary,
  computePerCardStats,
  findNemesisCard,
  findMostConsistentCard,
  computeDeckLevelStats,
  computeTimeOfDay,
  computeBestDayOfWeek,
} from '../data/stats';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

type Period = 'day' | 'week' | 'month' | 'year';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function periodStart(period: Period): string {
  switch (period) {
    case 'day':
      return todayString();
    case 'week':
      return daysAgo(7);
    case 'month':
      return daysAgo(30);
    case 'year':
      return daysAgo(365);
  }
}

export default function StatsScreen({ navigation }: Props) {
  const [logs, setLogs] = useState<CompletionLog[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [period, setPeriod] = useState<Period>('day');

  useFocusEffect(
    useCallback(() => {
      Promise.all([getAllLogs(), getAllCards(), getAllDecks(), getSettings()]).then(
        ([l, c, d, s]) => {
          setLogs(l);
          setCards(c);
          setDecks(d);
          setSettings(s);
        }
      );
    }, [])
  );

  const start = periodStart(period);
  const filtered = logs.filter((l) => l.date >= start);
  const summary = computeSummary(filtered, logs);
  const perCard = computePerCardStats(filtered, cards);
  const nemesis = findNemesisCard(perCard);
  const mostConsistent = findMostConsistentCard(perCard);
  const deckStats = computeDeckLevelStats(filtered, decks);
  const timeOfDay = computeTimeOfDay(filtered);
  const bestDow = computeBestDayOfWeek(logs); // all-time

  const show = (key: string) =>
    !settings || settings.preferredStatsDisplay.includes(key);

  const today = todayString();
  const todayLogs = logs
    .filter((l) => l.date === today)
    .sort((a, b) => a.timestamp - b.timestamp);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusEmoji: Record<string, string> = {
    complete: '\u2713',
    skipped: '\u2717',
    deferred: '\u21BB',
    shuffled: '\u2261',
  };

  const cardTitleById = (id: string) =>
    cards.find((c) => c.id === id)?.title ?? id.slice(0, 8);

  // Time-of-day total
  const todTotal =
    timeOfDay.morning + timeOfDay.afternoon + timeOfDay.evening + timeOfDay.lateNight;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'\u2039'} Back</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Goals')}>
          <Text style={styles.goalsLink}>Goals</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Stats</Text>

      {/* Period toggle */}
      <View style={styles.periodRow}>
        {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
          <Pressable
            key={p}
            style={[styles.periodBtn, period === p && styles.periodActive]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[
                styles.periodText,
                period === p && styles.periodTextActive,
              ]}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Completion % */}
        {show('completion_pct') && (
          <View style={styles.bigStat}>
            <Text style={styles.bigNumber}>{summary.completionPct}%</Text>
            <Text style={styles.bigLabel}>Completion Rate</Text>
          </View>
        )}

        {/* Core counts */}
        <View style={styles.grid}>
          <StatBox label="Completed" value={summary.completed} color="#4CAF50" />
          <StatBox label="Skipped" value={summary.skipped} color="#F44336" />
          <StatBox label="Deferred" value={summary.deferred} color="#FF9800" />
          <StatBox label="Shuffled" value={summary.shuffled} color="#9C27B0" />
        </View>

        {/* Streaks + total */}
        <View style={styles.grid}>
          {show('current_streak') && (
            <StatBox
              label="Current Streak"
              value={`${summary.currentStreak}d`}
              color="#FF5722"
            />
          )}
          {show('longest_streak') && (
            <StatBox
              label="Longest Streak"
              value={`${summary.longestStreak}d`}
              color="#795548"
            />
          )}
          {show('total_swipes') && (
            <StatBox
              label="Total Swipes"
              value={summary.totalSwipes}
              color="#4A90D9"
            />
          )}
        </View>

        {/* Nemesis + Most Consistent */}
        {(show('nemesis_card') || show('most_consistent_card')) &&
          (nemesis || mostConsistent) && (
            <>
              <Text style={styles.sectionTitle}>Card Insights</Text>
              {show('nemesis_card') && nemesis && (
                <View style={styles.insightRow}>
                  <Text style={styles.insightLabel}>
                    {'\uD83D\uDC7F'} Your Nemesis
                  </Text>
                  <View style={styles.insightBody}>
                    <Text style={styles.insightTitle} numberOfLines={1}>
                      {nemesis.title}
                    </Text>
                    <Text style={styles.insightDetail}>
                      Deferred {nemesis.deferred}x, skipped {nemesis.skipped}x
                    </Text>
                  </View>
                </View>
              )}
              {show('most_consistent_card') && mostConsistent && (
                <View style={styles.insightRow}>
                  <Text style={styles.insightLabel}>
                    {'\u2B50'} Most Consistent
                  </Text>
                  <View style={styles.insightBody}>
                    <Text style={styles.insightTitle} numberOfLines={1}>
                      {mostConsistent.title}
                    </Text>
                    <Text style={styles.insightDetail}>
                      {mostConsistent.completionPct}% over {mostConsistent.total} swipes
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

        {/* Per-card breakdown */}
        {show('per_card_trends') && perCard.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Per-Card Breakdown</Text>
            {[...perCard]
              .sort((a, b) => b.total - a.total)
              .slice(0, 10)
              .map((s) => (
                <View key={s.cardId} style={styles.cardStatRow}>
                  <Text style={styles.cardStatTitle} numberOfLines={1}>
                    {s.title}
                  </Text>
                  <View style={styles.cardStatBar}>
                    {s.complete > 0 && (
                      <View
                        style={{
                          flex: s.complete,
                          backgroundColor: '#4CAF50',
                        }}
                      />
                    )}
                    {s.skipped > 0 && (
                      <View
                        style={{
                          flex: s.skipped,
                          backgroundColor: '#F44336',
                        }}
                      />
                    )}
                    {s.deferred > 0 && (
                      <View
                        style={{
                          flex: s.deferred,
                          backgroundColor: '#FF9800',
                        }}
                      />
                    )}
                    {s.shuffled > 0 && (
                      <View
                        style={{
                          flex: s.shuffled,
                          backgroundColor: '#9C27B0',
                        }}
                      />
                    )}
                  </View>
                  <Text style={styles.cardStatTotal}>{s.total}</Text>
                </View>
              ))}
          </>
        )}

        {/* Deck-level completion */}
        {show('deck_completion_rate') && deckStats.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Deck Completion</Text>
            {deckStats.map((d) => (
              <View key={d.deckId} style={styles.deckStatRow}>
                <Text style={styles.deckStatName}>{d.name}</Text>
                <Text style={styles.deckStatRate}>{d.completionPct}%</Text>
                <Text style={styles.deckStatMeta}>
                  {d.daysComplete}/{d.daysPlayed} days
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Time of day */}
        {show('time_of_day') && todTotal > 0 && (
          <>
            <Text style={styles.sectionTitle}>When You Play</Text>
            <View style={styles.todRow}>
              <TodBar label="Morning" count={timeOfDay.morning} total={todTotal} color="#FFB74D" />
              <TodBar label="Afternoon" count={timeOfDay.afternoon} total={todTotal} color="#4FC3F7" />
              <TodBar label="Evening" count={timeOfDay.evening} total={todTotal} color="#9575CD" />
              <TodBar label="Late Night" count={timeOfDay.lateNight} total={todTotal} color="#455A64" />
            </View>
          </>
        )}

        {/* Best day of week */}
        {show('best_day_of_week') && bestDow && (
          <View style={styles.bestDowRow}>
            <Text style={styles.bestDowLabel}>
              {'\uD83C\uDFC6'} Best Day of Week
            </Text>
            <Text style={styles.bestDowValue}>
              {bestDow.day} ({bestDow.rate}%)
            </Text>
          </View>
        )}

        {/* Today's log */}
        {show('today_log') && period === 'day' && todayLogs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Today's Log</Text>
            {todayLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
                <Text style={styles.logStatus}>
                  {statusEmoji[log.status]}
                </Text>
                <Text style={styles.logCard} numberOfLines={1}>
                  {cardTitleById(log.cardId)}
                </Text>
              </View>
            ))}
          </>
        )}

        {filtered.length === 0 && (
          <Text style={styles.empty}>No activity in this period yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TodBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.todBar}>
      <View
        style={[
          styles.todFill,
          { width: `${pct}%`, backgroundColor: color },
        ]}
      />
      <View style={styles.todTextRow}>
        <Text style={styles.todLabel}>{label}</Text>
        <Text style={styles.todCount}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0EB' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  back: { fontSize: 17, color: '#4A90D9' },
  goalsLink: { fontSize: 16, color: '#4A90D9', fontWeight: '500' },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e8e3de',
  },
  periodActive: { backgroundColor: '#4A90D9' },
  periodText: { fontSize: 14, color: '#666', fontWeight: '500' },
  periodTextActive: { color: '#fff' },
  scroll: { padding: 20, paddingBottom: 60 },
  bigStat: { alignItems: 'center', marginBottom: 20 },
  bigNumber: { fontSize: 56, fontWeight: '700', color: '#222' },
  bigLabel: { fontSize: 14, color: '#888' },
  grid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  // Insights
  insightRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
    gap: 12,
  },
  insightLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    width: 120,
  },
  insightBody: { flex: 1 },
  insightTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  insightDetail: { fontSize: 12, color: '#999', marginTop: 2 },
  // Per-card
  cardStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    gap: 10,
  },
  cardStatTitle: { flex: 1, fontSize: 14, color: '#333' },
  cardStatBar: {
    flex: 2,
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  cardStatTotal: {
    fontSize: 12,
    color: '#888',
    width: 24,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  // Deck stat
  deckStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  deckStatName: { flex: 1, fontSize: 15, color: '#333' },
  deckStatRate: { fontSize: 16, fontWeight: '700', color: '#4A90D9', width: 50 },
  deckStatMeta: { fontSize: 12, color: '#888', width: 70, textAlign: 'right' },
  // Time-of-day
  todRow: { gap: 6 },
  todBar: {
    height: 28,
    backgroundColor: '#f0ebe6',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  todFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  todTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    zIndex: 1,
  },
  todLabel: { fontSize: 13, color: '#333', fontWeight: '500' },
  todCount: { fontSize: 13, color: '#333', fontWeight: '600' },
  // Best DoW
  bestDowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  bestDowLabel: { fontSize: 14, color: '#888', fontWeight: '500' },
  bestDowValue: { fontSize: 16, color: '#333', fontWeight: '700' },
  // Today's log
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    gap: 10,
  },
  logTime: { fontSize: 13, color: '#999', width: 60 },
  logStatus: { fontSize: 16, width: 20, textAlign: 'center' },
  logCard: { flex: 1, fontSize: 14, color: '#555' },
  empty: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 14,
    marginTop: 40,
  },
});
