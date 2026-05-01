import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import type { Card } from '../data/types';
import {
  getCard,
  saveCard,
  deleteCard,
  getDeck,
  saveDeck,
  appendCardsToActiveRun,
  generateId,
} from '../data/storage';
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
import CardComposer, { type CardState } from '../components/CardComposer';
import ScreenContainer from '../components/ScreenContainer';
import { identityFor } from '../cardIdentity';

type Props = NativeStackScreenProps<RootStackParamList, 'CardEditor'>;

export default function CardEditorScreen({ route, navigation }: Props) {
  const { cardId, deckId } = route.params;
  const isNew = !cardId;

  const [state, setState] = useState<CardState>({
    title: '',
    blocks: [],
    timerSeconds: undefined,
    link: undefined,
  });
  // Card position in the deck — drives which playing-card identity we deal.
  // Defaults to "next slot at the end" until the deck loads.
  const [originalPosition, setOriginalPosition] = useState<number>(0);

  useEffect(() => {
    if (cardId) {
      getCard(cardId).then((c) => {
        if (c) {
          setState({
            title: c.title,
            blocks: c.content,
            timerSeconds: c.timer?.durationSeconds,
            link: c.link,
          });
        }
      });
    }
  }, [cardId]);

  useEffect(() => {
    if (!deckId) return;
    getDeck(deckId).then((deck) => {
      if (!deck) return;
      if (cardId) {
        const ref = deck.cardRefs.find((r) => r.cardId === cardId);
        if (ref) setOriginalPosition(ref.positionInDeck);
      } else {
        // New card → it'll be appended at the next slot.
        setOriginalPosition(deck.cardRefs.length);
      }
    });
  }, [deckId, cardId]);

  const handleSave = async () => {
    if (!state.title.trim()) {
      window.alert('Please give the card a title.');
      return;
    }

    const card: Card = {
      id: cardId ?? generateId(),
      title: state.title.trim(),
      content: state.blocks.filter((b) => b.value.trim().length > 0),
      timer:
        state.timerSeconds != null && state.timerSeconds > 0
          ? { durationSeconds: state.timerSeconds }
          : undefined,
      link: state.link?.trim() ? state.link.trim() : undefined,
      createdAt: Date.now(),
    };

    await saveCard(card);

    if (isNew && deckId) {
      const deck = await getDeck(deckId);
      if (deck) {
        deck.cardRefs.push({
          cardId: card.id,
          positionInDeck: deck.cardRefs.length,
        });
        await saveDeck(deck);
        // Also append to today's active run so it appears in the live deck
        await appendCardsToActiveRun(deckId, [card.id]);
      }
    }

    navigation.goBack();
  };

  const handleDelete = async () => {
    if (!cardId) return;
    const confirmed = window.confirm('Delete this card from all decks?');
    if (!confirmed) return;
    await deleteCard(cardId);
    navigation.goBack();
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {isNew ? 'New Card' : 'Edit Card'}
        </Text>
        <Pressable onPress={handleSave}>
          <Text style={styles.save}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <CardComposer
          state={state}
          onChange={setState}
          size="full"
          identity={
            deckId ? identityFor(deckId, originalPosition) : undefined
          }
        />

        {!isNew && (
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteText}>Delete Card</Text>
          </Pressable>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  save: {
    fontFamily: font.text,
    fontSize: fontSize.body,
    color: color.linkOnFelt,
    fontWeight: fontWeight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: space[5],
    paddingTop: space[5],
    paddingBottom: space[9],
  },
  deleteBtn: {
    marginTop: space[7],
    padding: 14,
    borderRadius: radius.m,
    backgroundColor: suit.heart + '12',
    alignItems: 'center',
  },
  deleteText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: suit.heart,
    fontWeight: fontWeight.semibold,
  },
});
