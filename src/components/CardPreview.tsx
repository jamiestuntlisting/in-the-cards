import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
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
import { HeartIcon, TimerIcon } from '../design/icons';
import type { ContentBlock } from '../data/types';

interface CardPreviewProps {
  title: string;
  blocks: ContentBlock[];
  timerSeconds?: number;
  link?: string;
}

/**
 * Renders a live preview of a card exactly as it will appear in Play view.
 * Used in the Card Editor for WYSIWYG editing.
 */
export default function CardPreview({
  title,
  blocks,
  timerSeconds,
  link,
}: CardPreviewProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cornerSuit}>
        <HeartIcon size={16} color={suit.heart} strokeWidth={1.5} />
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.title} numberOfLines={4}>
          {title || 'Card title'}
        </Text>

        {blocks.map((block, i) => {
          if (!block.value.trim()) return null;
          if (block.type === 'text') {
            return (
              <Text key={i} style={styles.bodyText}>
                {block.value}
              </Text>
            );
          }
          if (block.type === 'image') {
            return (
              <Image
                key={i}
                source={{ uri: block.value }}
                style={styles.image}
                resizeMode="cover"
              />
            );
          }
          return null;
        })}

        {timerSeconds != null && timerSeconds > 0 && (
          <View style={styles.timerBadge}>
            <TimerIcon size={14} color={suit.club} strokeWidth={2} />
            <Text style={styles.timerText}>{timerSeconds}s</Text>
          </View>
        )}

        {link ? <Text style={styles.linkText}>{link}</Text> : null}
      </View>
    </View>
  );
}

// Scaled-down card — wide enough to give a good feel, short enough to fit
const PREVIEW_WIDTH = 260;
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH * (7 / 5));

const styles = StyleSheet.create({
  card: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: color.cardStroke,
    overflow: 'hidden',
    alignSelf: 'center',
    ...shadow.card,
  },
  cornerSuit: {
    position: 'absolute',
    top: space[2] + 2,
    left: space[2] + 2,
    opacity: 0.85,
    zIndex: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[4],
    paddingTop: space[6],
  },
  title: {
    fontFamily: font.display,
    fontSize: fontSize.displayS,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: space[2] + 2,
    lineHeight: fontSize.displayS * lineHeight.display,
  },
  bodyText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    lineHeight: fontSize.bodyS * lineHeight.body,
    color: color.fg2,
    marginBottom: space[2],
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 80,
    borderRadius: radius.s,
    marginBottom: space[2],
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: suitTint.club,
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.xs,
    marginTop: space[1] + 2,
  },
  timerText: {
    fontFamily: font.mono,
    fontSize: fontSize.label,
    color: suit.club,
    fontWeight: fontWeight.medium,
  },
  linkText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.link,
    marginTop: space[2],
    textAlign: 'center',
  },
});
