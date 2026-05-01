import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated';
import type { CardData } from './sampleCards';
import { CARD_WIDTH, CARD_HEIGHT } from './cardDimensions';
import {
  color,
  radius,
  shadow,
  paper,
  font,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  space,
  suit,
} from './design/tokens';
import { HeartIcon } from './design/icons';
import {
  type CardIdentity,
  DEFAULT_IDENTITY,
  colorForSuit,
} from './cardIdentity';
import { SuitGlyph } from './SwipeableCard';

interface CardStackProps {
  cards: CardData[];
  /** Optional per-card identity, parallel to `cards`. */
  identities?: CardIdentity[];
  shuffleJitter: SharedValue<number>;
}

/** Deterministic pseudo-random from card id, returns -1..1 */
function seededRandom(id: string, salt: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i) + salt) | 0;
  }
  return ((h % 200) - 100) / 100;
}

const MAX_VISIBLE_LAYERS = 6;

export default function CardStack({
  cards,
  identities,
  shuffleJitter,
}: CardStackProps) {
  const stackCards = cards.slice(1, MAX_VISIBLE_LAYERS + 1);

  return (
    <>
      {/* Render deepest first so the layer immediately under the top card
       *  paints last and shows its content on top of the deeper cream layers. */}
      {[...stackCards]
        .map((card, i) => ({
          card,
          layerIndex: i + 1,
          // identities is parallel to `cards` (the live ordered deck), so the
          // layer at slice-index `i` corresponds to cards[i+1].
          identity: identities?.[i + 1] ?? DEFAULT_IDENTITY,
        }))
        .reverse()
        .map(({ card, layerIndex, identity }) => {
          const rotation = seededRandom(card.id, 0) * 2;
          const offsetX = seededRandom(card.id, 1) * 2;
          const offsetY = seededRandom(card.id, 2) * 2;

          return (
            <StackLayer
              key={card.id}
              card={card}
              identity={identity}
              layerIndex={layerIndex}
              rotation={rotation}
              offsetX={offsetX}
              offsetY={offsetY}
              shuffleJitter={shuffleJitter}
            />
          );
        })}
    </>
  );
}

interface StackLayerProps {
  card: CardData;
  identity: CardIdentity;
  layerIndex: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  shuffleJitter: SharedValue<number>;
}

// Paper-tinted stack layers — warm, matching the design system
const STACK_COLORS = [
  '#FFFFFF', // immediately below top — same as top card so peek-through is seamless
  '#F7F1E6',
  paper[1],
  '#EFE8DB',
  paper[2],
  '#E6DDCD',
];

function StackLayer({
  card,
  identity,
  layerIndex,
  rotation,
  offsetX,
  offsetY,
  shuffleJitter,
}: StackLayerProps) {
  const pipColor = colorForSuit(identity.suit);
  const animatedStyle = useAnimatedStyle(() => {
    const jitter = shuffleJitter.value * (layerIndex % 2 === 0 ? 1 : -1) * 3;
    return {
      transform: [
        { translateX: offsetX + jitter },
        { translateY: offsetY + layerIndex * 2 },
        { rotate: `${rotation + jitter * 0.3}deg` },
      ],
      zIndex: -layerIndex,
    };
  });

  const bg = STACK_COLORS[Math.min(layerIndex - 1, STACK_COLORS.length - 1)];

  // Only the layer immediately under the top card renders content — deeper
  // layers stay as solid paper so the stack still reads as physical depth.
  const showContent = layerIndex === 1;

  return (
    <Animated.View
      style={[styles.stackCard, { backgroundColor: bg }, animatedStyle]}
    >
      {showContent && (
        <>
          <View style={styles.innerFrame} pointerEvents="none" />
          <View style={styles.cornerTL} pointerEvents="none">
            <Text style={[styles.cornerRank, { color: pipColor }]}>
              {identity.rank}
            </Text>
            <SuitGlyph suit={identity.suit} size={20} color={pipColor} />
          </View>
          <View style={styles.cornerBR} pointerEvents="none">
            <Text style={[styles.cornerRank, { color: pipColor }]}>
              {identity.rank}
            </Text>
            <SuitGlyph suit={identity.suit} size={20} color={pipColor} />
          </View>
          <View style={styles.peekContent}>
            <Text style={styles.peekTitle} numberOfLines={4}>
              {card.title}
            </Text>
          </View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stackCard: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: color.cardStroke,
    overflow: 'hidden',
    ...shadow.flat,
  },
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
  cornerTL: {
    position: 'absolute',
    top: space[3],
    left: space[3] + 2,
    alignItems: 'center',
    zIndex: 2,
    opacity: 0.6,
  },
  cornerBR: {
    position: 'absolute',
    bottom: space[3],
    right: space[3] + 2,
    alignItems: 'center',
    zIndex: 2,
    opacity: 0.6,
    transform: [{ rotate: '180deg' }],
  },
  cornerRank: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: fontWeight.regular,
    marginBottom: 2,
  },
  peekContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[6],
    paddingTop: space[8],
    zIndex: 1,
  },
  peekTitle: {
    fontFamily: font.display,
    fontSize: fontSize.displayM,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: fontSize.displayM * lineHeight.display,
  },
});
