import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface DeckCompleteProps {
  stats: {
    total: number;
    completed: number;
    skipped: number;
    deferred: number;
    shuffled: number;
  };
  onRestart: () => void;
}

export default function DeckComplete({ stats, onRestart }: DeckCompleteProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>&#127183;</Text>
      <Text style={styles.title}>Deck Complete!</Text>

      <View style={styles.statsGrid}>
        <StatRow label="Completed" value={stats.completed} color="#4CAF50" />
        <StatRow label="Skipped" value={stats.skipped} color="#F44336" />
        <StatRow label="Deferred" value={stats.deferred} color="#FF9800" />
        <StatRow label="Shuffled" value={stats.shuffled} color="#9C27B0" />
      </View>

      <Text style={styles.totalText}>
        {stats.total} cards swiped
      </Text>

      <Pressable style={styles.restartButton} onPress={onRestart}>
        <Text style={styles.restartText}>Play Again</Text>
      </Pressable>
    </View>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  if (value === 0) return null;
  return (
    <View style={styles.statRow}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    marginBottom: 24,
  },
  statsGrid: {
    width: '100%',
    maxWidth: 260,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statLabel: {
    flex: 1,
    fontSize: 16,
    color: '#555',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 32,
  },
  restartButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#4A90D9',
    borderRadius: 24,
  },
  restartText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
