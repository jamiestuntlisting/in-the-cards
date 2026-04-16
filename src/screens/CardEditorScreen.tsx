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
      content: blocks.filter(
        (b) => b.value.trim().length > 0
      ),
      timer: timerSeconds ? { durationSeconds: parseInt(timerSeconds, 10) } : undefined,
      link: link.trim() || undefined,
      createdAt: Date.now(),
    };

    await saveCard(card);

    // If new card and we have a deckId, add it to the deck
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

  return (
    <View style={styles.container}>
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
        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Card title"
          placeholderTextColor="#bbb"
          autoFocus={isNew}
        />

        {/* Content blocks */}
        <Text style={styles.label}>Content</Text>
        {blocks.map((block, i) => (
          <View key={i} style={styles.blockRow}>
            <Text style={styles.blockType}>
              {block.type === 'text' ? 'T' : '\uD83D\uDDBC'}
            </Text>
            <TextInput
              style={styles.blockInput}
              value={block.value}
              onChangeText={(v) => updateBlock(i, v)}
              placeholder={
                block.type === 'text' ? 'Text content...' : 'Image URL...'
              }
              placeholderTextColor="#bbb"
              multiline={block.type === 'text'}
            />
            {block.type === 'image' && block.value ? (
              <Image
                source={{ uri: block.value }}
                style={styles.imagePreview}
              />
            ) : null}
            <Pressable onPress={() => removeBlock(i)}>
              <Text style={styles.removeBlock}>{'\u00D7'}</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.addBlockRow}>
          <Pressable style={styles.addBlockBtn} onPress={addTextBlock}>
            <Text style={styles.addBlockText}>+ Text</Text>
          </Pressable>
          <Pressable style={styles.addBlockBtn} onPress={addImageBlock}>
            <Text style={styles.addBlockText}>+ Image</Text>
          </Pressable>
        </View>

        {/* Timer */}
        <Text style={styles.label}>Timer (optional)</Text>
        <TextInput
          style={styles.input}
          value={timerSeconds}
          onChangeText={setTimerSeconds}
          placeholder="Duration in seconds"
          placeholderTextColor="#bbb"
          keyboardType="numeric"
        />

        {/* Link */}
        <Text style={styles.label}>Link (optional)</Text>
        <TextInput
          style={styles.input}
          value={link}
          onChangeText={setLink}
          placeholder="https://..."
          placeholderTextColor="#bbb"
          autoCapitalize="none"
        />

        {/* Delete */}
        {!isNew && (
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteText}>Delete Card</Text>
          </Pressable>
        )}
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
  save: { fontSize: 16, color: '#4A90D9', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  blockType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#aaa',
    width: 24,
    textAlign: 'center',
    paddingTop: 4,
  },
  blockInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    minHeight: 36,
  },
  imagePreview: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  removeBlock: {
    fontSize: 20,
    color: '#ccc',
    paddingHorizontal: 4,
  },
  addBlockRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addBlockBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBlockText: { fontSize: 14, color: '#4A90D9', fontWeight: '600' },
  deleteBtn: {
    marginTop: 32,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
  },
  deleteText: { fontSize: 15, color: '#F44336', fontWeight: '600' },
});
