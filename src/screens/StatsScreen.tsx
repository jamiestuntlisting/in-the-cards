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
import {
  ChevronLeftIcon,
  CheckIcon,
  SkipIcon,
  DeferIcon,
  ShuffleIcon,
  SpadeIcon,
  HeartIcon,
} from '../design/icons';
import ScreenContainer from '../components/ScreenContainer';

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
      Promise.all([
        getAllLogs(),
        getAllCards(),
        getAllDecks(),
        getSettings(),
      ]).then(([l, c, d, s]) => {
        setLogs(l);
        setCards(c);
        setDecks(d);
        setSettings(s);
      });
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
  const bestDow = computeBestDayOfWeek(logs);

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

  const statusIcon = (status: string) => {
    const iconSize = 14;
    if (status === 'complete')
      return <CheckIcon size={iconSize} color={suit.heart} strokeWidth={2.2} />;
    if (status === 'skipped')
      return <SkipIcon size={iconSize} color={suit.spade} strokeWidth={2.2} />;
    if (status === 'deferred')
      return <DeferIcon size={iconSize} color={suit.diamond} strokeWidth={2.2} />;
    if (status === 'shuffled')
      return <ShuffleIcon size={iconSize} color={suit.club} strokeWidth={2.2} />;
    return null;
  };

  const cardTitleById = (id: string) =>
    cards.find((c) => c.id === id)?.title ?? id.slice(0, 8);

  const todTotal =
    timeOfDay.morning +
    timeOfDay.afternoon +
    timeOfDay.evening +
    timeOfDay.lateNight;

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <ChevronLeftIcon size={22} color={color.linkOnFelt} strokeWidth={2.2} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Goals')}>
          <Text style={styles.goalsLink}>Goals</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Stats</Text>

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
        {show('completion_pct') && (
          <View style={styles.bigStat}>
            <Text style={styles.bigNumber}>{summary.completionPct}%</Text>
            <Text style={styles.bigLabel}>Completion Rate</Text>
          </View>
        )}

        <View style={styles.grid}>
          <StatBox label="Completed" value={summary.completed} color={suit.heart} />
          <StatBox label="Skipped" value={summary.skipped} color={suit.spade} />
          <StatBox label="Deferred" value={summary.deferred} color={suit.diamond} />
          <StatBox label="Shuffled" value={summary.shuffled} color={suit.club} />
        </View>

        <View style={styles.grid}>
          {show('current_streak') && (
            <StatBox
              label="Current Streak"
              value={`${summary.currentStreak}d`}
              color={suit.heart}
            />
          )}
          {show('longest_streak') && (
            <StatBox
              label="Longest Streak"
              value={`${summary.longestStreak}d`}
              color={color.fg2}
            />
          )}
          {show('total_swipes') && (
            <StatBox
              label="Total Swipes"
              value={summary.totalSwipes}
              color={color.link}
            />
          )}
        </View>

        {(show('nemesis_card') || show('most_consistent_card')) &&
          (nemesis || mostConsistent) && (
            <>
              <Text style={styles.sectionTitle}>Card Insights</Text>
              {show('nemesis_card') && nemesis && (
                <View style={styles.insightRow}>
                  <SpadeIcon size={20} color={suit.spade} strokeWidth={1.75} />
                  <View style={styles.insightBody}>
                    <Text style={styles.insightLabel}>Your Nemesis</Text>
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
                  <HeartIcon size={20} color={suit.heart} strokeWidth={1.75} />
                  <View style={styles.insightBody}>
                    <Text style={styles.insightLabel}>Most Consistent</Text>
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
                        style={{ flex: s.complete, backgroundColor: suit.heart }}
                      />
                    )}
                    {s.skipped > 0 && (
                      <View
                        style={{ flex: s.skipped, backgroundColor: suit.spade }}
                      />
                    )}
                    {s.deferred > 0 && (
                      <View
                        style={{
                          flex: s.deferred,
                          backgroundColor: suit.diamond,
                        }}
                      />
                    )}
                    {s.shuffled > 0 && (
                      <View
                        style={{ flex: s.shuffled, backgroundColor: suit.club }}
                      />
                    )}
                  </View>
                  <Text style={styles.cardStatTotal}>{s.total}</Text>
                </View>
              ))}
          </>
        )}

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

        {show('time_of_day') && todTotal > 0 && (
          <>
            <Text style={styles.sectionTitle}>When You Play</Text>
            <View style={styles.todRow}>
              <TodBar label="Morning" count={timeOfDay.morning} total={todTotal} color={suit.diamond} />
              <TodBar label="Afternoon" count={timeOfDay.afternoon} total={todTotal} color={suit.club} />
              <TodBar label="Evening" count={timeOfDay.evening} total={todTotal} color={suit.heart} />
              <TodBar label="Late Night" count={timeOfDay.lateNight} total={todTotal} color={suit.spade} />
            </View>
          </>
        )}

        {show('best_day_of_week') && bestDow && (
          <View style={styles.bestDowRow}>
            <Text style={styles.bestDowLabel}>Best Day of Week</Text>
            <Text style={styles.bestDowValue}>
              {bestDow.day} ({bestDow.rate}%)
            </Text>
          </View>
        )}

        {show('today_log') && period === 'day' && todayLogs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Today's Log</Text>
            {todayLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
                <View style={styles.logStatus}>{statusIcon(log.status)}</View>
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
    </ScreenContainer>
  );
}

function StatBox({
  label,
  value,
  color: valueColor,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TodBar({
  label,
  count,
  total,
  color: barColor,
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
          { width: `${pct}%`, backgroundColor: barColor },
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
  container: { flex: 1, backgroundColor: color.bgPage },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[9],
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.linkOnFelt,
  },
  goalsLink: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.linkOnFelt,
    fontWeight: fontWeight.medium,
  },
  heading: {
    fontFamily: font.display,
    fontSize: fontSize.displayM,
    fontWeight: fontWeight.regular,
    color: color.fgOnFelt1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
  },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: space[5],
    gap: space[2],
    marginBottom: space[4],
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: color.bgSurface,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  periodActive: {
    backgroundColor: suit.heart,
    borderColor: suit.heart,
  },
  periodText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg3,
    fontWeight: fontWeight.medium,
  },
  periodTextActive: { color: '#fff' },
  scroll: { padding: space[5], paddingBottom: space[9] },
  bigStat: { alignItems: 'center', marginBottom: space[5] },
  bigNumber: {
    fontFamily: font.mono,
    fontSize: fontSize.displayXl,
    fontWeight: fontWeight.semibold,
    color: color.fgOnFelt1,
  },
  bigLabel: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fgOnFelt2,
  },
  grid: { flexDirection: 'row', gap: space[2] + 2, marginBottom: space[2] + 2 },
  statBox: {
    flex: 1,
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.hairline,
  },
  statValue: {
    fontFamily: font.mono,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.semibold,
  },
  statLabel: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fg4,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fgOnFelt2,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginTop: space[5],
    marginBottom: space[2],
  },
  // Insights
  insightRow: {
    flexDirection: 'row',
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: 14,
    marginBottom: space[2],
    alignItems: 'center',
    gap: space[3],
    borderWidth: 1,
    borderColor: color.hairline,
  },
  insightBody: { flex: 1 },
  insightLabel: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fg4,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginBottom: 2,
  },
  insightTitle: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    fontWeight: fontWeight.semibold,
    color: color.fg1,
  },
  insightDetail: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg3,
    marginTop: 2,
  },
  // Per-card
  cardStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bgRaised,
    borderRadius: radius.s,
    padding: space[2] + 2,
    marginBottom: space[1],
    gap: space[2] + 2,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  cardStatTitle: {
    flex: 1,
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg1,
  },
  cardStatBar: {
    flex: 2,
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.xs,
    overflow: 'hidden',
    backgroundColor: color.hairline,
  },
  cardStatTotal: {
    fontFamily: font.mono,
    fontSize: fontSize.micro,
    color: color.fg3,
    width: 24,
    textAlign: 'right',
  },
  // Deck stats
  deckStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bgRaised,
    borderRadius: radius.s,
    padding: space[3],
    marginBottom: space[1],
    borderWidth: 1,
    borderColor: color.hairline,
  },
  deckStatName: {
    flex: 1,
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.fg1,
  },
  deckStatRate: {
    fontFamily: font.mono,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: suit.heart,
    width: 52,
  },
  deckStatMeta: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fg4,
    width: 70,
    textAlign: 'right',
  },
  // ToD
  todRow: { gap: space[1] + 2 },
  todBar: {
    height: 28,
    backgroundColor: color.bgSunken,
    borderRadius: radius.s,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  todFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    opacity: 0.7,
  },
  todTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space[3] - 2,
    zIndex: 1,
  },
  todLabel: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg1,
    fontWeight: fontWeight.medium,
  },
  todCount: {
    fontFamily: font.mono,
    fontSize: fontSize.bodyS,
    color: color.fg1,
    fontWeight: fontWeight.semibold,
  },
  // Best DoW
  bestDowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: 14,
    marginTop: space[3],
    borderWidth: 1,
    borderColor: color.hairline,
  },
  bestDowLabel: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg3,
    fontWeight: fontWeight.medium,
  },
  bestDowValue: {
    fontFamily: font.display,
    fontSize: fontSize.bodyL,
    color: color.fg1,
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  // Today's log
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bgRaised,
    borderRadius: radius.s,
    padding: space[2] + 2,
    marginBottom: space[1],
    gap: space[2] + 2,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  logTime: {
    fontFamily: font.mono,
    fontSize: fontSize.micro,
    color: color.fg4,
    width: 52,
  },
  logStatus: { width: 20, alignItems: 'center' },
  logCard: {
    flex: 1,
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg2,
  },
  empty: {
    fontFamily: font.text,
    textAlign: 'center',
    color: color.fgOnFelt3,
    fontSize: fontSize.bodyS,
    marginTop: space[8],
  },
});
