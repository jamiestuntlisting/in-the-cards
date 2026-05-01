import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  color,
  font,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  radius,
  shadow,
  space,
  suit,
  suitTint,
} from '../design/tokens';
import {
  TimerIcon,
  PlusIcon,
  SkipIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '../design/icons';
import { CARD_WIDTH, CARD_HEIGHT } from '../cardDimensions';
import {
  type CardIdentity,
  DEFAULT_IDENTITY,
  colorForSuit,
} from '../cardIdentity';
import { SuitGlyph } from '../SwipeableCard';
import type { ContentBlock } from '../data/types';

export interface CardState {
  title: string;
  blocks: ContentBlock[];
  timerSeconds?: number;
  link?: string;
}

interface Props {
  state: CardState;
  onChange: (next: CardState) => void;
  /** Visual size — "full" for the edit screen, "inline" for compact use on Deck Detail */
  size?: 'full' | 'inline';
  /** Playing-card identity — if omitted, defaults to Ace of Hearts. */
  identity?: CardIdentity;
}

/**
 * Editable card — the card IS the editor. Title and content blocks are
 * TextInputs styled to match the Play-view card. Toolbar below adds/removes
 * text, image, timer, and link.
 */
export default function CardComposer({
  state,
  onChange,
  size = 'full',
  identity = DEFAULT_IDENTITY,
}: Props) {
  const { title, blocks, timerSeconds, link } = state;
  const pipColor = colorForSuit(identity.suit);

  const set = (patch: Partial<CardState>) => onChange({ ...state, ...patch });

  const updateBlock = (index: number, value: string) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], value };
    set({ blocks: updated });
  };

  const removeBlock = (index: number) => {
    set({ blocks: blocks.filter((_, i) => i !== index) });
  };

  const moveBlock = (index: number, dir: 'up' | 'down') => {
    const to = dir === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= blocks.length) return;
    const updated = [...blocks];
    [updated[index], updated[to]] = [updated[to], updated[index]];
    set({ blocks: updated });
  };

  const addText = () => set({ blocks: [...blocks, { type: 'text', value: '' }] });
  const addImage = () =>
    set({ blocks: [...blocks, { type: 'image', value: '' }] });
  const toggleTimer = () =>
    set({ timerSeconds: timerSeconds == null ? 60 : undefined });
  const toggleLink = () => set({ link: link == null ? '' : undefined });

  const cardStyle = size === 'inline' ? styles.cardInline : styles.cardFull;
  const titleStyle =
    size === 'inline' ? styles.titleInline : styles.titleFull;
  const bodyTextStyle =
    size === 'inline' ? styles.bodyTextInline : styles.bodyTextFull;
  const imageStyle = size === 'inline' ? styles.imageInline : styles.imageFull;

  const isFull = size === 'full';
  const cornerSize = isFull ? 20 : 14;
  const cornerRankStyle = isFull ? styles.cornerRank : styles.cornerRankInline;

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, cardStyle]}>
        <View style={styles.innerFrame} pointerEvents="none" />
        {isFull && (
          <View style={styles.watermark} pointerEvents="none">
            <SuitGlyph
              suit={identity.suit}
              size={220}
              color={pipColor}
              strokeWidth={1}
            />
          </View>
        )}

        <View style={styles.cornerTL} pointerEvents="none">
          <Text style={[cornerRankStyle, { color: pipColor }]}>
            {identity.rank}
          </Text>
          <SuitGlyph
            suit={identity.suit}
            size={cornerSize}
            color={pipColor}
          />
        </View>
        <View style={styles.cornerBR} pointerEvents="none">
          <Text style={[cornerRankStyle, { color: pipColor }]}>
            {identity.rank}
          </Text>
          <SuitGlyph
            suit={identity.suit}
            size={cornerSize}
            color={pipColor}
          />
        </View>

        <View style={isFull ? styles.cardContent : styles.cardContentInline}>
          <TextInput
            value={title}
            onChangeText={(v) => set({ title: v })}
            placeholder="Name this card"
            placeholderTextColor={color.fg4}
            multiline
            style={titleStyle}
          />

          {blocks.map((block, i) => (
            <BlockEditor
              key={i}
              block={block}
              index={i}
              canMoveUp={i > 0}
              canMoveDown={i < blocks.length - 1}
              onChange={(v) => updateBlock(i, v)}
              onRemove={() => removeBlock(i)}
              onMove={(dir) => moveBlock(i, dir)}
              textStyle={bodyTextStyle}
              imageStyle={imageStyle}
            />
          ))}

          {timerSeconds != null && (
            <View style={styles.timerRow}>
              <TimerIcon size={16} color={suit.club} strokeWidth={2} />
              <TextInput
                value={String(timerSeconds)}
                onChangeText={(v) =>
                  set({ timerSeconds: v ? parseInt(v, 10) || 0 : 0 })
                }
                keyboardType="numeric"
                style={styles.timerInput}
                placeholder="0"
                placeholderTextColor={color.fg4}
              />
              <Text style={styles.timerLabel}>seconds</Text>
              <Pressable onPress={toggleTimer} hitSlop={6}>
                <SkipIcon size={14} color={color.fg4} strokeWidth={2} />
              </Pressable>
            </View>
          )}

          {link != null && (
            <View style={styles.linkRow}>
              <TextInput
                value={link}
                onChangeText={(v) => set({ link: v })}
                placeholder="https://..."
                placeholderTextColor={color.fg4}
                style={styles.linkInput}
                autoCapitalize="none"
              />
              <Pressable onPress={toggleLink} hitSlop={6}>
                <SkipIcon size={14} color={color.fg4} strokeWidth={2} />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <ToolButton label="Text" onPress={addText}>
          <PlusIcon size={14} color={color.link} strokeWidth={2.2} />
          <Text style={styles.toolText}>Text</Text>
        </ToolButton>
        <ToolButton label="Image" onPress={addImage}>
          <PlusIcon size={14} color={color.link} strokeWidth={2.2} />
          <Text style={styles.toolText}>Image</Text>
        </ToolButton>
        <ToolButton
          label="Timer"
          onPress={toggleTimer}
          active={timerSeconds != null}
        >
          <TimerIcon
            size={14}
            color={timerSeconds != null ? '#fff' : color.link}
            strokeWidth={2.2}
          />
          <Text
            style={[
              styles.toolText,
              timerSeconds != null && styles.toolTextActive,
            ]}
          >
            Timer
          </Text>
        </ToolButton>
        <ToolButton label="Link" onPress={toggleLink} active={link != null}>
          <Text
            style={[
              styles.toolLink,
              link != null && styles.toolTextActive,
            ]}
          >
            {'\uD83D\uDD17'}
          </Text>
          <Text
            style={[
              styles.toolText,
              link != null && styles.toolTextActive,
            ]}
          >
            Link
          </Text>
        </ToolButton>
      </View>
    </View>
  );
}

function ToolButton({
  children,
  onPress,
  active = false,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toolBtn, active && styles.toolBtnActive]}
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

interface BlockEditorProps {
  block: ContentBlock;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (v: string) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
  textStyle: any;
  imageStyle: any;
}

function BlockEditor({
  block,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMove,
  textStyle,
  imageStyle,
}: BlockEditorProps) {
  return (
    <View style={styles.blockRow}>
      <View style={styles.blockMain}>
        {block.type === 'image' && block.value ? (
          <Image
            source={{ uri: block.value }}
            style={imageStyle}
            resizeMode="cover"
          />
        ) : null}
        <TextInput
          value={block.value}
          onChangeText={onChange}
          placeholder={
            block.type === 'text' ? 'Add text...' : 'Paste image URL'
          }
          placeholderTextColor={color.fg4}
          multiline={block.type === 'text'}
          autoCapitalize={block.type === 'image' ? 'none' : 'sentences'}
          style={textStyle}
        />
      </View>
      <View style={styles.blockControls}>
        <Pressable onPress={() => onMove('up')} disabled={!canMoveUp} hitSlop={4}>
          <ChevronUpIcon
            size={12}
            color={canMoveUp ? color.link : color.fgDisabled}
            strokeWidth={2.2}
          />
        </Pressable>
        <Pressable
          onPress={() => onMove('down')}
          disabled={!canMoveDown}
          hitSlop={4}
        >
          <ChevronDownIcon
            size={12}
            color={canMoveDown ? color.link : color.fgDisabled}
            strokeWidth={2.2}
          />
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={4}>
          <SkipIcon size={12} color={color.fg4} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Sizing ───
// Full = exact match to play-view card so wrapping is WYSIWYG.
// Inline = compact size for Deck Detail rows.
const INLINE_WIDTH = 260;
const INLINE_HEIGHT = Math.round(INLINE_WIDTH * (7 / 5));

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  card: {
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: color.cardStroke,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardFull: { width: CARD_WIDTH, height: CARD_HEIGHT },
  cardInline: { width: INLINE_WIDTH, height: INLINE_HEIGHT },
  innerFrame: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: color.cardInnerFrame,
    zIndex: 0,
  },
  watermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.05,
    zIndex: 0,
  },
  cornerTL: {
    position: 'absolute',
    top: space[3],
    left: space[3] + 2,
    alignItems: 'center',
    zIndex: 2,
  },
  cornerBR: {
    position: 'absolute',
    bottom: space[3],
    right: space[3] + 2,
    alignItems: 'center',
    zIndex: 2,
    transform: [{ rotate: '180deg' }],
  },
  cornerRank: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: fontWeight.regular,
    marginBottom: 2,
  },
  cornerRankInline: {
    fontFamily: font.display,
    fontSize: 14,
    lineHeight: 14,
    fontWeight: fontWeight.regular,
    marginBottom: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[6],
    paddingTop: space[8],
    gap: space[2],
    zIndex: 1,
  },
  cardContentInline: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[4],
    paddingTop: space[7],
    gap: space[2],
    zIndex: 1,
  },
  titleFull: {
    fontFamily: font.display,
    fontSize: fontSize.displayL,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: fontSize.displayL * lineHeight.display,
    minWidth: 180,
    paddingVertical: 2,
  },
  titleInline: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: fontSize.displayS * lineHeight.display,
    minWidth: 160,
    paddingVertical: 2,
  },
  bodyTextFull: {
    fontFamily: font.text,
    fontSize: fontSize.bodyL,
    lineHeight: fontSize.bodyL * lineHeight.body,
    color: color.fg2,
    textAlign: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  bodyTextInline: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    lineHeight: fontSize.bodyS * lineHeight.body,
    color: color.fg2,
    textAlign: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  imageFull: {
    width: CARD_WIDTH - space[6] * 2,
    height: 160,
    borderRadius: radius.s,
    marginBottom: space[3],
  },
  imageInline: {
    width: INLINE_WIDTH - space[4] * 2,
    height: 70,
    borderRadius: radius.s,
    marginBottom: space[2],
  },
  // Block row — content + reorder/remove controls
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    minWidth: 0,
    gap: 4,
  },
  blockMain: { flex: 1, minWidth: 0 },
  blockControls: {
    flexDirection: 'column',
    gap: 3,
    paddingTop: 6,
    alignItems: 'center',
  },
  // Timer row inside card
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 6,
    backgroundColor: suitTint.club,
    paddingHorizontal: space[2] + 2,
    paddingVertical: 4,
    borderRadius: radius.xs,
    marginTop: space[1] + 2,
  },
  timerInput: {
    fontFamily: font.mono,
    fontSize: fontSize.bodyS,
    color: suit.club,
    fontWeight: fontWeight.semibold,
    width: 60,
    textAlign: 'center',
    padding: 0,
  },
  timerLabel: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: suit.club,
    flex: 1,
  },
  // Link row inside card
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
    minWidth: 0,
    marginTop: space[1] + 2,
  },
  linkInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.link,
    textAlign: 'center',
    padding: 0,
  },
  // Toolbar
  toolbar: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[3],
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[3],
    paddingVertical: space[2] - 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.bgRaised,
  },
  toolBtnActive: {
    backgroundColor: suit.heart,
    borderColor: suit.heart,
  },
  toolText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.link,
    fontWeight: fontWeight.medium,
  },
  toolLink: { fontSize: 12 },
  toolTextActive: { color: '#fff' },
});
