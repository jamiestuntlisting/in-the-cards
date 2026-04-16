import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import type { Settings } from '../data/types';
import { getSettings, saveSettings } from '../data/storage';

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
        <TextInput
          style={styles.input}
          value={settings.morningTime}
          onChangeText={(v) => update({ morningTime: v })}
          placeholder="HH:MM"
          placeholderTextColor="#bbb"
        />

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

        <Text style={[styles.label, { marginTop: 24 }]}>About</Text>
        <Text style={styles.aboutText}>
          In the Cards v0.1.0{'\n'}
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
  aboutText: {
    fontSize: 14,
    color: '#888',
    lineHeight: 22,
  },
});
