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
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'\u2039'} Back</Text>
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
          placeholderTextColor="#bbb"
        />

        <Text style={styles.label}>Notification Permission</Text>
        <Text style={styles.value}>
          {settings.notificationPermission}
        </Text>

        {/* Stats display toggles */}
        <Text style={[styles.label, { marginTop: 24 }]}>Stats Display</Text>
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
                <Text style={styles.statToggleLabel}>{STATS_LABELS[key]}</Text>
                <Switch
                  value={active}
                  onValueChange={() => toggleStat(key)}
                  trackColor={{ true: '#4A90D9', false: '#ddd' }}
                />
              </View>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: 24 }]}>About</Text>
        <Text style={styles.aboutText}>
          In the Cards v0.2.0{'\n'}
          A card-based daily routine app.
        </Text>
      </ScrollView>
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
    paddingBottom: 16,
  },
  scroll: { padding: 20, paddingBottom: 40 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  hint: { fontSize: 13, color: '#aaa', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
  },
  value: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#555',
  },
  timeInputWrap: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'flex-start',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  statToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statToggleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0ebe6',
  },
  statToggleLabel: { fontSize: 14, color: '#333', flex: 1 },
  aboutText: {
    fontSize: 14,
    color: '#888',
    lineHeight: 22,
  },
});
