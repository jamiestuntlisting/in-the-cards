import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { saveDeck, generateId } from '../data/storage';
import {
  DECK_TEMPLATES,
  createDeckFromTemplate,
  type DeckTemplate,
} from '../data/seedData';

type Props = NativeStackScreenProps<RootStackParamList, 'NewDeck'>;

export default function NewDeckScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [isRandom, setIsRandom] = useState(false);

  const createBlank = async () => {
    if (!name.trim()) return;
    const deck = {
      id: generateId(),
      name: name.trim(),
      orderMode: (isRandom ? 'random' : 'fixed') as 'fixed' | 'random',
      cardRefs: [],
      createdAt: Date.now(),
    };
    await saveDeck(deck);
    navigation.replace('DeckDetail', { deckId: deck.id });
  };

  const createFromTemplate = async (template: DeckTemplate) => {
    const deck = await createDeckFromTemplate(template);
    navigation.replace('DeckDetail', { deckId: deck.id });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Deck</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Templates */}
        <Text style={styles.sectionTitle}>Start from template</Text>
        {DECK_TEMPLATES.map((tmpl) => (
          <Pressable
            key={tmpl.name}
            style={styles.templateCard}
            onPress={() => createFromTemplate(tmpl)}
          >
            <Text style={styles.templateName}>{tmpl.name}</Text>
            <Text style={styles.templateMeta}>
              {tmpl.cards.length} cards {'\u2022'}{' '}
              {tmpl.orderMode === 'random' ? 'Random' : 'Fixed'}
            </Text>
            <Text style={styles.templatePreview} numberOfLines={2}>
              {tmpl.cards.map((c) => c.title).join(' \u2022 ')}
            </Text>
          </Pressable>
        ))}

        {/* Blank deck */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          Or create blank
        </Text>
        <View style={styles.blankForm}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Deck name"
            placeholderTextColor="#bbb"
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Random order</Text>
            <Switch
              value={isRandom}
              onValueChange={setIsRandom}
              trackColor={{ true: '#4A90D9', false: '#ddd' }}
            />
          </View>

          <Pressable
            style={[
              styles.createBtn,
              !name.trim() && styles.createBtnDisabled,
            ]}
            onPress={createBlank}
            disabled={!name.trim()}
          >
            <Text style={styles.createText}>Create Deck</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0EB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e0db',
  },
  cancel: { fontSize: 16, color: '#888' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  templateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.06)',
  },
  templateName: { fontSize: 18, fontWeight: '600', color: '#222' },
  templateMeta: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    marginBottom: 6,
  },
  templatePreview: {
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
  },
  blankForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  nameInput: {
    fontSize: 17,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    color: '#222',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleLabel: { fontSize: 15, color: '#555' },
  createBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  createBtnDisabled: { opacity: 0.4 },
  createText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
