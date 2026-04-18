import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import type { Settings } from '../data/types';
import {
  getSettings,
  saveSettings,
  ALL_STATS_KEYS,
  STATS_LABELS,
} from '../data/storage';
import TimeInput from '../components/TimeInput';
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
import { ChevronLeftIcon } from '../design/icons';
import ScreenContainer from '../components/ScreenContainer';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettings);
    }, [])
  );

  const update = async (partial: Partial<Settings>) => {
    if (!settings) return;
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await saveSettings(updated);
  };

  const toggleStat = async (key: string) => {
    if (!settings) return;
    const has = settings.preferredStatsDisplay.includes(key);
    const next = has
      ? settings.preferredStatsDisplay.filter((k) => k !== key)
      : [...settings.preferredStatsDisplay, key];
    await update({ preferredStatsDisplay: next });
  };

  if (!settings) return null;

  return (
    <ScreenContainer>
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

      <Text style={styles.heading}>Settings</Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Morning Time</Text>
        <View style={styles.timeInputWrap}>
          <TimeInput
            value={settings.morningTime}
            onChange={(v) => update({ morningTime: v })}
          />
        </View>

        <Text style={styles.label}>Timezone Fallback</Text>
        <TextInput
          style={styles.input}
          value={settings.timezone ?? ''}
          onChangeText={(v) => update({ timezone: v || undefined })}
          placeholder="Auto-detected (e.g. America/New_York)"
          placeholderTextColor={color.fg4}
        />

        <Text style={styles.label}>Notification Permission</Text>
        <Text style={styles.value}>{settings.notificationPermission}</Text>

        <Text style={[styles.label, { marginTop: space[6] }]}>
          Stats Display
        </Text>
        <Text style={styles.hint}>
          Choose which stats appear in the Progress view.
        </Text>
        <View style={styles.statsCard}>
          {ALL_STATS_KEYS.map((key, idx) => {
            const active = settings.preferredStatsDisplay.includes(key);
            return (
              <View
                key={key}
                style={[
                  styles.statToggleRow,
                  idx < ALL_STATS_KEYS.length - 1 && styles.statToggleRowBorder,
                ]}
              >
                <Text style={styles.statToggleLabel}>
                  {STATS_LABELS[key]}
                </Text>
                <Switch
                  value={active}
                  onValueChange={() => toggleStat(key)}
                  trackColor={{ true: suit.heart, false: color.hairline }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: space[6] }]}>About</Text>
        <Text style={styles.aboutText}>
          In the Cards v0.3.0{'\n'}
          A card-based daily routine app.
        </Text>
      </ScrollView>
    </ScreenContainer>
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
    paddingBottom: space[4],
  },
  scroll: { padding: space[5], paddingBottom: space[8] },
  label: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fg3,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginTop: space[4],
    marginBottom: space[2] - 2,
  },
  hint: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg4,
    marginBottom: space[2],
  },
  input: {
    fontFamily: font.text,
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: 14,
    fontSize: fontSize.ui,
    color: color.fg1,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  value: {
    fontFamily: font.text,
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: 14,
    fontSize: fontSize.ui,
    color: color.fg3,
    borderWidth: 1,
    borderColor: color.hairline,
    textTransform: 'capitalize',
  },
  timeInputWrap: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: space[2] + 2,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: color.hairline,
  },
  statsCard: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  statToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: space[2] + 2,
  },
  statToggleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: color.hairlineSoft,
  },
  statToggleLabel: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg1,
    flex: 1,
  },
  aboutText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg3,
    lineHeight: fontSize.bodyS * 1.7,
  },
});
