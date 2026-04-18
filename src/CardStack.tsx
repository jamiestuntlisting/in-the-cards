import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated';
import type { CardData } from './sampleCards';
import { CARD_WIDTH, CARD_HEIGHT } from './cardDimensions';
import { color, radius, shadow, paper } from './design/tokens';

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
      {stackCards.map((card, i) => {
        const layerIndex = i + 1;
        const rotation = seededRandom(card.id, 0) * 2;
        const offsetX = seededRandom(card.id, 1) * 2;
        const offsetY = seededRandom(card.id, 2) * 2;

        return (
          <StackLayer
            key={card.id}
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
  layerIndex: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  shuffleJitter: SharedValue<number>;
}

// Paper-tinted stack layers — warm, matching the design system
const STACK_COLORS = [
  paper[0], // top of stack
  '#F7F1E6',
  paper[1],
  '#EFE8DB',
  paper[2],
  '#E6DDCD',
];

function StackLayer({
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

  return (
    <Animated.View
      style={[
        styles.stackCard,
        { backgroundColor: bg },
        animatedStyle,
      ]}
    />
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
    ...shadow.flat,
  },
});
