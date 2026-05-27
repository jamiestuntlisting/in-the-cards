import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CardResponse } from '../data/types';
import { getResponsesForCard } from '../data/storage';
import {
  color,
  font,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  suit,
} from '../design/tokens';

interface Props {
  cardId: string;
}

/**
 * Per-card response analytics shown in the Card Editor. Summarizes recorded
 * answers to the card's prompt: 0–10 scale stats (count / average / latest)
 * with a recent-values trend, and a dated list of text notes.
 *
 * Renders nothing when the card has no recorded responses.
 */
export default function CardAnalytics({ cardId }: Props) {
  const [responses, setResponses] = useState<CardResponse[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getResponsesForCard(cardId).then((r) => {
      if (!cancelled) setResponses(r);
    });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  if (!responses || responses.length === 0) return null;

  const scaleResponses = responses.filter((r) => typeof r.scale === 'number');
  const textResponses = responses.filter(
    (r) => r.text != null && r.text.trim().length > 0
  );

  const scaleValues = scaleResponses.map((r) => r.scale as number);
  const avg =
    scaleValues.length > 0
      ? scaleValues.reduce((a, b) => a + b, 0) / scaleValues.length
      : null;
  const latest =
    scaleValues.length > 0 ? scaleValues[scaleValues.length - 1] : null;
  const min = scaleValues.length > 0 ? Math.min(...scaleValues) : null;
  const max = scaleValues.length > 0 ? Math.max(...scaleValues) : null;

  // Recent trend — last 12 scale values as mini vertical bars (0–10 → height).
  const recent = scaleValues.slice(-12);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Responses ({responses.length})</Text>

      {scaleValues.length > 0 && (
        <View style={styles.card}>
          <View style={styles.statRow}>
            <Stat label="Avg" value={avg!.toFixed(1)} />
            <Stat label="Latest" value={String(latest)} />
            <Stat label="Low" value={String(min)} />
            <Stat label="High" value={String(max)} />
          </View>

          <View style={styles.trendWrap}>
            <View style={styles.trendBars}>
              {recent.map((v, i) => (
                <View key={i} style={styles.trendCol}>
                  <View
                    style={[
                      styles.trendBar,
                      { height: `${Math.max(6, (v / 10) * 100)}%` },
                    ]}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.trendCaption}>
              Last {recent.length} {recent.length === 1 ? 'rating' : 'ratings'}{' '}
              (0–10)
            </Text>
          </View>
        </View>
      )}

      {textResponses.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.notesHeader}>Notes</Text>
          {textResponses
            .slice()
            .reverse()
            .slice(0, 10)
            .map((r) => (
              <View key={r.id} style={styles.noteRow}>
                <Text style={styles.noteDate}>{formatDate(r.date)}</Text>
                <Text style={styles.noteText}>{r.text}</Text>
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDate(date: string): string {
  // 'YYYY-MM-DD' → 'Mon D'
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return date;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[m - 1]} ${d}`;
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: space[7],
    gap: space[3],
  },
  sectionTitle: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fgOnFelt2,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
  },
  card: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: color.cardStroke,
    padding: space[4],
    gap: space[3],
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontFamily: font.mono,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.semibold,
    color: color.fg1,
  },
  statLabel: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fg3,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginTop: 2,
  },
  trendWrap: {
    gap: space[1] + 2,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    paddingTop: space[3],
  },
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 56,
  },
  trendCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '100%',
    backgroundColor: suit.heart,
    borderRadius: radius.xs,
    minHeight: 4,
  },
  trendCaption: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fg4,
    textAlign: 'center',
  },
  notesHeader: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fg3,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
  },
  noteRow: {
    flexDirection: 'row',
    gap: space[3],
    borderTopWidth: 1,
    borderTopColor: color.hairlineSoft,
    paddingTop: space[2] + 2,
  },
  noteDate: {
    fontFamily: font.mono,
    fontSize: fontSize.bodyS,
    color: color.fg4,
    width: 52,
  },
  noteText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg2,
    flex: 1,
    lineHeight: fontSize.bodyS * 1.4,
  },
});
