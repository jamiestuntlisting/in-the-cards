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
import type { CompletionLog } from '../data/types';
import { getAllLogs, todayString } from '../data/storage';

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
  const [period, setPeriod] = useState<Period>('day');

  useFocusEffect(
    useCallback(() => {
      getAllLogs().then(setLogs);
    }, [])
  );

  const start = periodStart(period);
  const filtered = logs.filter((l) => l.date >= start);

  const total = filtered.length;
  const completed = filtered.filter((l) => l.status === 'complete').length;
  const skipped = filtered.filter((l) => l.status === 'skipped').length;
  const deferred = filtered.filter((l) => l.status === 'deferred').length;
  const shuffled = filtered.filter((l) => l.status === 'shuffled').length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Streak calculation (consecutive days with at least one complete)
  const allDates = [...new Set(logs.filter((l) => l.status === 'complete').map((l) => l.date))].sort().reverse();
  let currentStreak = 0;
  let checkDate = todayString();
  for (const date of allDates) {
    if (date === checkDate) {
      currentStreak++;
      const d = new Date(checkDate);
      d.setDate(d.getDate() - 1);
      checkDate = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  // Today's log
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
        {/* Big number */}
        <View style={styles.bigStat}>
          <Text style={styles.bigNumber}>{completionPct}%</Text>
          <Text style={styles.bigLabel}>Completion Rate</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.grid}>
          <StatBox label="Completed" value={completed} color="#4CAF50" />
          <StatBox label="Skipped" value={skipped} color="#F44336" />
          <StatBox label="Deferred" value={deferred} color="#FF9800" />
          <StatBox label="Shuffled" value={shuffled} color="#9C27B0" />
        </View>

        <View style={styles.grid}>
          <StatBox label="Total Swipes" value={total} color="#4A90D9" />
          <StatBox
            label="Current Streak"
            value={`${currentStreak}d`}
            color="#FF5722"
          />
        </View>

        {/* Today's log */}
        {period === 'day' && todayLogs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Today's Log</Text>
            {todayLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
                <Text style={styles.logStatus}>
                  {statusEmoji[log.status]}
                </Text>
                <Text style={styles.logCard} numberOfLines={1}>
                  {log.cardId.slice(0, 8)}...
                </Text>
              </View>
            ))}
          </>
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
  scroll: { padding: 20, paddingBottom: 40 },
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
});
