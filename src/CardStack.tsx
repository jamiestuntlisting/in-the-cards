import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';
import type { CardData } from './sampleCards';
import { CARD_WIDTH, CARD_HEIGHT } from './cardDimensions';

interface CardStackProps {
  cards: CardData[];
  /** Shared value that jiggles during shuffle animation */
  shuffleJitter: SharedValue<number>;
}

/** Deterministic pseudo-random from card id, returns -1..1 */
function seededRandom(id: string, salt: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i) + salt) | 0;
  }
  return ((h % 200) - 100) / 100; // -1..1
}

const MAX_VISIBLE_LAYERS = 6;

export default function CardStack({ cards, shuffleJitter }: CardStackProps) {
  // Show up to 6 layers behind the top card (index 0 is top, skip it)
  const stackCards = cards.slice(1, MAX_VISIBLE_LAYERS + 1);

  return (
    <>
      {stackCards.map((card, i) => {
        const layerIndex = i + 1; // 1-based depth
        const rotation = seededRandom(card.id, 0) * 2; // ±2 degrees
        const offsetX = seededRandom(card.id, 1) * 2; // ±2px
        const offsetY = seededRandom(card.id, 2) * 2; // ±2px

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

  return (
    <Animated.View
      style={[
        styles.stackCard,
        {
          // Deeper cards are slightly darker
          backgroundColor: `hsl(0, 0%, ${Math.max(88 - layerIndex * 2, 75)}%)`,
        },
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
    borderRadius: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
});
