import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  color,
  font,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  radius,
  shadow,
  space,
  suit,
} from './design/tokens';
import { PlayIcon, HeartIcon } from './design/icons';

interface DeckCompleteProps {
  stats: {
    total: number;
    completed: number;
    skipped: number;
    deferred: number;
    shuffled: number;
  };
  nextDeckName?: string;
  onPlayNext?: () => void;
  onBackToList: () => void;
}

// Card-back mark (from design system: decorative diamond lattice card)
function CardBackMark({ size = 96 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size * 1.4}
      viewBox="0 0 60 84"
      fill="none"
      stroke={suit.heart}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x="2" y="2" width="56" height="80" rx="6" fill={color.bgRaised} />
      <Path d="M30 10 L48 30 L30 50 L12 30 Z" opacity="0.35" />
      <Path d="M30 34 L48 54 L30 74 L12 54 Z" opacity="0.35" />
      <Path d="M30 42 L37 50 L30 58 L23 50 Z" fill={suit.heart} opacity="0.6" />
    </Svg>
  );
}

export default function DeckComplete({
  stats,
  nextDeckName,
  onPlayNext,
  onBackToList,
}: DeckCompleteProps) {
  const completionPct =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.markWrap}>
        <CardBackMark size={80} />
      </View>

      <Text style={styles.title}>Deck Complete</Text>

      <Text style={styles.bigPct}>{completionPct}%</Text>
      <Text style={styles.bigPctLabel}>completed</Text>

      <View style={styles.statsGrid}>
        <StatRow label="Completed" value={stats.completed} color={suit.heart} />
        <StatRow label="Skipped" value={stats.skipped} color={suit.spade} />
        <StatRow label="Deferred" value={stats.deferred} color={suit.diamond} />
        <StatRow label="Shuffled" value={stats.shuffled} color={suit.club} />
      </View>

      <Text style={styles.totalText}>{stats.total} cards swiped</Text>

      {nextDeckName && onPlayNext && (
        <Pressable style={styles.primaryButton} onPress={onPlayNext}>
          <PlayIcon size={18} color="#fff" strokeWidth={2.2} />
          <Text style={styles.primaryText}>Play {nextDeckName}</Text>
        </Pressable>
      )}

      <Pressable
        style={[
          styles.secondaryButton,
          !nextDeckName && styles.primaryButton,
        ]}
        onPress={onBackToList}
      >
        <Text
          style={nextDeckName ? styles.secondaryText : styles.primaryText}
        >
          Back to Decks
        </Text>
      </Pressable>
    </View>
  );
}

function StatRow({
  label,
  value,
  color: dotColor,
}: {
  label: string;
  value: number;
  color: string;
}) {
  if (value === 0) return null;
  return (
    <View style={styles.statRow}>
      <View style={[styles.statDot, { backgroundColor: dotColor }]} />
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
    padding: space[7],
  },
  markWrap: { marginBottom: space[4] },
  title: {
    fontFamily: font.display,
    fontSize: fontSize.displayL,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    marginBottom: space[4],
    textAlign: 'center',
  },
  bigPct: {
    fontFamily: font.mono,
    fontSize: fontSize.displayXl,
    fontWeight: fontWeight.semibold,
    color: suit.heart,
    marginBottom: -4,
    lineHeight: fontSize.displayXl * lineHeight.display,
  },
  bigPctLabel: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg3,
    marginBottom: space[6],
  },
  statsGrid: {
    width: '100%',
    maxWidth: 280,
    marginBottom: space[4],
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[1] + 2,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: space[3] - 2,
  },
  statLabel: {
    flex: 1,
    fontFamily: font.text,
    fontSize: fontSize.body,
    color: color.fg2,
  },
  statValue: {
    fontFamily: font.mono,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: color.fg1,
  },
  totalText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg4,
    marginBottom: space[6],
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[7],
    paddingVertical: 14,
    backgroundColor: suit.heart,
    borderRadius: radius.xl,
    marginTop: space[2] + 2,
    minWidth: 240,
    ...shadow.fab,
  },
  primaryText: {
    fontFamily: font.text,
    color: '#fff',
    fontSize: fontSize.bodyL,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    paddingHorizontal: space[7],
    paddingVertical: space[3],
    marginTop: space[1] + 2,
    minWidth: 240,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: font.text,
    color: color.fg3,
    fontSize: fontSize.ui,
    fontWeight: fontWeight.medium,
  },
});
