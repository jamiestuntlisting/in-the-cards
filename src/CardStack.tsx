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

interface CardStackProps {
  cards: CardData[];
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

export default function CardStack({ cards, shuffleJitter }: CardStackProps) {
  const stackCards = cards.slice(1, MAX_VISIBLE_LAYERS + 1);

  return (
    <>
      {/* Render deepest first so the layer immediately under the top card
       *  paints last and shows its content on top of the deeper cream layers. */}
      {[...stackCards]
        .map((card, i) => ({ card, layerIndex: i + 1 }))
        .reverse()
        .map(({ card, layerIndex }) => {
          const rotation = seededRandom(card.id, 0) * 2;
          const offsetX = seededRandom(card.id, 1) * 2;
          const offsetY = seededRandom(card.id, 2) * 2;

          return (
            <StackLayer
              key={card.id}
              card={card}
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
  layerIndex,
  rotation,
  offsetX,
  offsetY,
  shuffleJitter,
}: StackLayerProps) {
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
          <View style={styles.cornerSuit}>
            <HeartIcon size={16} color={suit.heart} strokeWidth={1.5} />
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
  cornerSuit: {
    position: 'absolute',
    top: space[3],
    left: space[3],
    opacity: 0.6,
    zIndex: 1,
  },
  peekContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[6],
    paddingTop: space[8],
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
