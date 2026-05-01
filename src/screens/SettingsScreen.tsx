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
  exportAllData,
  importAllData,
  countAllData,
  dumpRawLocalStorage,
  resetAllData,
  type DataCounts,
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
  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettings);
      countAllData().then(setCounts);
    }, [])
  );

  const refreshCounts = async () => {
    setCounts(await countAllData());
  };

  const handleExport = async () => {
    const json = await exportAllData();
    setExportText(json);
    // Try to also copy to clipboard on web
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(json);
      } catch {
        // ignore; user can still copy from the textarea
      }
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    try {
      const result = await importAllData(importText, 'merge');
      window.alert(
        `Imported ${result.cards} cards, ${result.decks} decks, ${result.logs} logs.`
      );
      setImportText('');
      await refreshCounts();
    } catch (e: any) {
      window.alert(
        `Import failed: ${e?.message ?? 'Could not parse the JSON.'}`
      );
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      'Delete all cards, decks, runs, goals, and settings from this device? This cannot be undone.'
    );
    if (!confirmed) return;
    await resetAllData();
    await refreshCounts();
    window.alert('All data wiped. Reload the app to reseed the tutorial.');
  };

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
          <ChevronLeftIcon size={22} color={color.linkOnFelt} strokeWidth={2.2} />
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

        {/* Data — backup / restore / transfer across devices */}
        <Text style={[styles.label, { marginTop: space[6] }]}>Data</Text>
        <Text style={styles.hint}>
          Cards live in this browser's local storage. Export to move them
          to another device.
        </Text>
        {counts && (
          <View style={styles.dataCard}>
            <Text style={styles.dataCountsText}>
              {counts.cards} cards {'\u2022'} {counts.decks} decks {'\u2022'}{' '}
              {counts.logs} logs
            </Text>
          </View>
        )}

        <View style={styles.dataButtons}>
          <Pressable style={styles.dataBtn} onPress={handleExport}>
            <Text style={styles.dataBtnText}>Export</Text>
          </Pressable>
          <Pressable
            style={styles.dataBtn}
            onPress={() => setShowRaw((v) => !v)}
          >
            <Text style={styles.dataBtnText}>
              {showRaw ? 'Hide raw storage' : 'Show raw storage'}
            </Text>
          </Pressable>
        </View>

        {exportText != null && (
          <View style={styles.exportBox}>
            <Text style={styles.exportHint}>
              Copied to clipboard. You can also select and copy below:
            </Text>
            <TextInput
              value={exportText}
              multiline
              editable
              selectTextOnFocus
              style={styles.exportTextArea}
            />
            <Pressable onPress={() => setExportText(null)}>
              <Text style={styles.clearBtnText}>Hide</Text>
            </Pressable>
          </View>
        )}

        {showRaw && (
          <View style={styles.rawBox}>
            {dumpRawLocalStorage().map(({ key, bytes }) => (
              <Text key={key} style={styles.rawRow}>
                {key} {'\u2192'} {bytes} bytes
              </Text>
            ))}
            {dumpRawLocalStorage().length === 0 && (
              <Text style={styles.rawRow}>(empty)</Text>
            )}
          </View>
        )}

        <Text style={[styles.label, { marginTop: space[5] }]}>
          Import from JSON
        </Text>
        <TextInput
          value={importText}
          onChangeText={setImportText}
          placeholder="Paste an export bundle here..."
          placeholderTextColor={color.fg4}
          multiline
          style={styles.importTextArea}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[
            styles.dataBtn,
            styles.dataBtnPrimary,
            !importText.trim() && styles.dataBtnDisabled,
          ]}
          onPress={handleImport}
          disabled={!importText.trim()}
        >
          <Text style={styles.dataBtnPrimaryText}>Import &amp; merge</Text>
        </Pressable>

        <Pressable style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetText}>Reset all data</Text>
        </Pressable>

        <Text style={[styles.label, { marginTop: space[6] }]}>About</Text>
        <Text style={styles.aboutText}>
          In the Cards v0.4.0 (data-transfer){'\n'}
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
    color: color.linkOnFelt,
  },
  heading: {
    fontFamily: font.display,
    fontSize: fontSize.displayM,
    fontWeight: fontWeight.regular,
    color: color.fgOnFelt1,
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
    color: color.fgOnFelt2,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginTop: space[4],
    marginBottom: space[2] - 2,
  },
  hint: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fgOnFelt3,
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
  // Data section
  dataCard: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: space[3] + 2,
    borderWidth: 1,
    borderColor: color.hairline,
    marginBottom: space[2],
  },
  dataCountsText: {
    fontFamily: font.mono,
    fontSize: fontSize.bodyS,
    color: color.fg2,
  },
  dataButtons: {
    flexDirection: 'row',
    gap: space[2],
    marginBottom: space[2],
    flexWrap: 'wrap',
  },
  dataBtn: {
    flex: 1,
    minWidth: 120,
    paddingHorizontal: space[3],
    paddingVertical: space[2] + 2,
    borderRadius: radius.m,
    backgroundColor: color.bgRaised,
    borderWidth: 1,
    borderColor: color.hairline,
    alignItems: 'center',
  },
  dataBtnText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.link,
    fontWeight: fontWeight.medium,
  },
  dataBtnPrimary: {
    backgroundColor: suit.heart,
    borderColor: suit.heart,
    marginTop: space[2],
  },
  dataBtnDisabled: { opacity: 0.4 },
  dataBtnPrimaryText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: '#fff',
    fontWeight: fontWeight.semibold,
  },
  exportBox: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: space[3],
    borderWidth: 1,
    borderColor: color.hairline,
    marginBottom: space[2],
    gap: space[2],
  },
  exportHint: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fg3,
  },
  exportTextArea: {
    fontFamily: font.mono,
    fontSize: fontSize.micro,
    color: color.fg2,
    minHeight: 120,
    padding: space[2],
    backgroundColor: color.bgPagePaper,
    borderRadius: radius.s,
    textAlignVertical: 'top',
  },
  clearBtnText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.link,
    textAlign: 'right',
  },
  rawBox: {
    backgroundColor: color.bgPagePaper,
    borderRadius: radius.s,
    padding: space[3],
    borderWidth: 1,
    borderColor: color.hairline,
    marginBottom: space[2],
  },
  rawRow: {
    fontFamily: font.mono,
    fontSize: fontSize.micro,
    color: color.fg3,
    paddingVertical: 2,
  },
  importTextArea: {
    fontFamily: font.mono,
    fontSize: fontSize.micro,
    color: color.fg1,
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: space[3],
    minHeight: 100,
    borderWidth: 1,
    borderColor: color.hairline,
    textAlignVertical: 'top',
  },
  resetBtn: {
    marginTop: space[5],
    padding: 12,
    borderRadius: radius.m,
    backgroundColor: suit.heart + '14',
    alignItems: 'center',
  },
  resetText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: suit.heart,
    fontWeight: fontWeight.semibold,
  },
});
