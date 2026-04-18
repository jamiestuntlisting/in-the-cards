import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import type { Card, ContentBlock, Deck } from '../data/types';
import {
  getCard,
  saveCard,
  deleteCard,
  getDeck,
  saveDeck,
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
import {
  ChevronUpIcon,
  ChevronDownIcon,
  SkipIcon,
  PlusIcon,
} from '../design/icons';
import CardPreview from '../components/CardPreview';
import ScreenContainer from '../components/ScreenContainer';

type Props = NativeStackScreenProps<RootStackParamList, 'CardEditor'>;

export default function CardEditorScreen({ route, navigation }: Props) {
  const { cardId, deckId } = route.params;
  const isNew = !cardId;

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [timerSeconds, setTimerSeconds] = useState('');
  const [link, setLink] = useState('');

  useEffect(() => {
    if (cardId) {
      getCard(cardId).then((c) => {
        if (c) {
          setTitle(c.title);
          setBlocks(c.content);
          setTimerSeconds(c.timer ? String(c.timer.durationSeconds) : '');
          setLink(c.link ?? '');
        }
      });
    }
  }, [cardId]);

  const handleSave = async () => {
    if (!title.trim()) {
      window.alert('Please enter a card title.');
      return;
    }

    const card: Card = {
      id: cardId ?? generateId(),
      title: title.trim(),
      content: blocks.filter((b) => b.value.trim().length > 0),
      timer: timerSeconds
        ? { durationSeconds: parseInt(timerSeconds, 10) }
        : undefined,
      link: link.trim() || undefined,
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

  const addTextBlock = () => {
    setBlocks([...blocks, { type: 'text', value: '' }]);
  };

  const addImageBlock = () => {
    setBlocks([...blocks, { type: 'image', value: '' }]);
  };

  const updateBlock = (index: number, value: string) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], value };
    setBlocks(updated);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    if (toIndex < 0 || toIndex >= blocks.length) return;
    const updated = [...blocks];
    [updated[index], updated[toIndex]] = [updated[toIndex], updated[index]];
    setBlocks(updated);
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
        {/* Live preview — WYSIWYG */}
        <View style={styles.previewWrap}>
          <CardPreview
            title={title}
            blocks={blocks}
            timerSeconds={
              timerSeconds ? parseInt(timerSeconds, 10) || undefined : undefined
            }
            link={link.trim() || undefined}
          />
          <Text style={styles.previewLabel}>Live preview</Text>
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Card title"
          placeholderTextColor={color.fg4}
          autoFocus={isNew}
        />

        <Text style={styles.label}>Content</Text>
        {blocks.map((block, i) => (
          <View key={i} style={styles.blockRow}>
            <Text style={styles.blockType}>
              {block.type === 'text' ? 'Aa' : 'IMG'}
            </Text>
            <TextInput
              style={styles.blockInput}
              value={block.value}
              onChangeText={(v) => updateBlock(i, v)}
              placeholder={
                block.type === 'text' ? 'Text content...' : 'Image URL...'
              }
              placeholderTextColor={color.fg4}
              multiline={block.type === 'text'}
            />
            {block.type === 'image' && block.value ? (
              <Image
                source={{ uri: block.value }}
                style={styles.imagePreview}
              />
            ) : null}
            {blocks.length > 1 && (
              <View style={styles.reorderBtns}>
                <Pressable
                  onPress={() => moveBlock(i, 'up')}
                  disabled={i === 0}
                  hitSlop={4}
                >
                  <ChevronUpIcon
                    size={14}
                    color={i === 0 ? color.fgDisabled : color.link}
                    strokeWidth={2.2}
                  />
                </Pressable>
                <Pressable
                  onPress={() => moveBlock(i, 'down')}
                  disabled={i === blocks.length - 1}
                  hitSlop={4}
                >
                  <ChevronDownIcon
                    size={14}
                    color={
                      i === blocks.length - 1
                        ? color.fgDisabled
                        : color.link
                    }
                    strokeWidth={2.2}
                  />
                </Pressable>
              </View>
            )}
            <Pressable onPress={() => removeBlock(i)} hitSlop={4}>
              <SkipIcon size={16} color={color.fg4} strokeWidth={2} />
            </Pressable>
          </View>
        ))}

        <View style={styles.addBlockRow}>
          <Pressable style={styles.addBlockBtn} onPress={addTextBlock}>
            <PlusIcon size={14} color={color.link} strokeWidth={2.2} />
            <Text style={styles.addBlockText}>Text</Text>
          </Pressable>
          <Pressable style={styles.addBlockBtn} onPress={addImageBlock}>
            <PlusIcon size={14} color={color.link} strokeWidth={2.2} />
            <Text style={styles.addBlockText}>Image</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Timer (optional)</Text>
        <TextInput
          style={styles.input}
          value={timerSeconds}
          onChangeText={setTimerSeconds}
          placeholder="Duration in seconds"
          placeholderTextColor={color.fg4}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Link (optional)</Text>
        <TextInput
          style={styles.input}
          value={link}
          onChangeText={setLink}
          placeholder="https://..."
          placeholderTextColor={color.fg4}
          autoCapitalize="none"
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
  container: { flex: 1, backgroundColor: color.bgPage },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[9],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
  },
  cancel: {
    fontFamily: font.text,
    fontSize: fontSize.body,
    color: color.fg3,
  },
  headerTitle: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
  },
  save: {
    fontFamily: font.text,
    fontSize: fontSize.body,
    color: color.link,
    fontWeight: fontWeight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: space[5], paddingBottom: space[9] },
  previewWrap: {
    alignItems: 'center',
    marginTop: space[3],
    marginBottom: space[2],
  },
  previewLabel: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fg4,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginTop: space[2] + 2,
  },
  label: {
    fontFamily: font.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: color.fg3,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
    marginTop: space[4],
    marginBottom: space[2],
  },
  titleInput: {
    fontFamily: font.display,
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: 14,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: color.hairline,
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
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: color.bgRaised,
    borderRadius: radius.m,
    padding: space[3] - 2,
    marginBottom: space[1] + 2,
    gap: space[2],
    borderWidth: 1,
    borderColor: color.hairline,
  },
  blockType: {
    fontFamily: font.mono,
    fontSize: fontSize.micro,
    fontWeight: fontWeight.semibold,
    color: color.fg4,
    width: 28,
    textAlign: 'center',
    paddingTop: 8,
  },
  blockInput: {
    flex: 1,
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: color.fg1,
    minHeight: 36,
  },
  imagePreview: {
    width: 40,
    height: 40,
    borderRadius: radius.s,
  },
  reorderBtns: {
    flexDirection: 'column',
    gap: 2,
    width: 18,
    alignItems: 'center',
    paddingTop: 6,
  },
  addBlockRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
  },
  addBlockBtn: {
    flex: 1,
    padding: space[3],
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: color.hairline,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addBlockText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.link,
    fontWeight: fontWeight.semibold,
  },
  deleteBtn: {
    marginTop: space[7],
    padding: 14,
    borderRadius: radius.m,
    backgroundColor: suit.heart + '12', // ~7% opacity red
    alignItems: 'center',
  },
  deleteText: {
    fontFamily: font.text,
    fontSize: fontSize.ui,
    color: suit.heart,
    fontWeight: fontWeight.semibold,
  },
});
