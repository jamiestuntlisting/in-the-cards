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
import { FixedOrderIcon, RandomOrderIcon } from '../design/icons';
import ScreenContainer from '../components/ScreenContainer';

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
    <ScreenContainer>
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
        <Text style={styles.sectionTitle}>Start from template</Text>
        {DECK_TEMPLATES.map((tmpl) => {
          const OrderIcon =
            tmpl.orderMode === 'random' ? RandomOrderIcon : FixedOrderIcon;
          return (
            <Pressable
              key={tmpl.name}
              style={styles.templateCard}
              onPress={() => createFromTemplate(tmpl)}
            >
              <Text style={styles.templateName}>{tmpl.name}</Text>
              <View style={styles.templateMetaRow}>
                <Text style={styles.templateMeta}>
                  {tmpl.cards.length} cards
                </Text>
                <OrderIcon size={13} color={color.fg4} />
                <Text style={styles.templateMeta}>
                  {tmpl.orderMode === 'random' ? 'Random' : 'Fixed'}
                </Text>
              </View>
              <Text style={styles.templatePreview} numberOfLines={2}>
                {tmpl.cards.map((c) => c.title).join('  \u2022  ')}
              </Text>
            </Pressable>
          );
        })}

        <Text style={[styles.sectionTitle, { marginTop: space[7] }]}>
          Or create blank
        </Text>
        <View style={styles.blankForm}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Deck name"
            placeholderTextColor={color.fg4}
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Random order</Text>
            <Switch
              value={isRandom}
              onValueChange={setIsRandom}
              trackColor={{ true: suit.heart, false: color.hairline }}
              thumbColor="#fff"
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bgPage },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[9],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.hairlineOnFelt,
  },
  cancel: {
    fontFamily: font.text,
    fontSize: fontSize.body,
    color: color.fgOnFelt2,
  },
  headerTitle: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fgOnFelt1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: space[5], paddingBottom: space[9] },
  sectionTitle: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fgOnFelt2,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginBottom: space[3],
  },
  templateCard: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    padding: space[4],
    marginBottom: space[2] + 2,
    borderWidth: 1,
    borderColor: color.cardStroke,
  },
  templateName: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  templateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[1] + 2,
    marginBottom: space[2],
  },
  templateMeta: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg3,
  },
  templatePreview: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.fg4,
    lineHeight: fontSize.bodyS * 1.5,
  },
  blankForm: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    padding: space[4],
    borderWidth: 1,
    borderColor: color.hairline,
  },
  nameInput: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    padding: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[3],
  },
  toggleLabel: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.fg2,
  },
  createBtn: {
    backgroundColor: suit.heart,
    borderRadius: radius.m,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space[2],
  },
  createBtnDisabled: { opacity: 0.4 },
  createText: {
    fontFamily: font.text,
    color: '#fff',
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
