import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import type { CardData } from './sampleCards';
import TimerOverlay from './TimerOverlay';
import { CARD_WIDTH, CARD_HEIGHT } from './cardDimensions';

export type SwipeDirection = 'right' | 'left' | 'up' | 'down';

interface SwipeableCardProps {
  card: CardData;
  onSwipe: (direction: SwipeDirection) => void;
  onLongPressDismiss: () => void;
  /** Flip-reveal: 0 = face-down (rotated), 1 = face-up */
  flipProgress: Animated.SharedValue<number>;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

export default function SwipeableCard({
  card,
  onSwipe,
  onLongPressDismiss,
  flipProgress,
}: SwipeableCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardRotation = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);
  const isAnimating = useSharedValue(false);

  // Long press state
  const longPressProgress = useSharedValue(0);
  const isLongPressing = useSharedValue(false);
  const longPressTranslateX = useSharedValue(0);
  const longPressTranslateY = useSharedValue(0);

  const animateExit = (direction: SwipeDirection) => {
    'worklet';
    isAnimating.value = true;
    const duration = direction === 'left' || direction === 'down' ? 600 : 500;

    switch (direction) {
      case 'right':
        // Fly right, rotate 15deg, fade slightly
        translateX.value = withTiming(SCREEN_WIDTH + 200, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
        cardRotation.value = withTiming(15, { duration });
        cardOpacity.value = withTiming(0.3, { duration }, () => {
          runOnJS(onSwipe)('right');
        });
        break;

      case 'up':
        // Fly up, fade aggressively
        translateY.value = withTiming(-SCREEN_HEIGHT - 200, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
        cardOpacity.value = withTiming(0, { duration }, () => {
          runOnJS(onSwipe)('up');
        });
        break;

      case 'left':
        // Arc back — slide left then spring back behind next card
        translateX.value = withTiming(
          -120,
          { duration: 200, easing: Easing.out(Easing.cubic) },
          () => {
            translateX.value = withSpring(0, { damping: 12, stiffness: 100 });
            translateY.value = withTiming(20, { duration: 200 });
            cardScale.value = withTiming(
              0.95,
              { duration: 300 },
              () => {
                cardOpacity.value = withTiming(0, { duration: 100 }, () => {
                  runOnJS(onSwipe)('left');
                });
              }
            );
          }
        );
        break;

      case 'down':
        // Drop down into deck
        translateY.value = withTiming(
          100,
          { duration: 250, easing: Easing.in(Easing.cubic) },
          () => {
            cardScale.value = withTiming(0.9, { duration: 200 });
            cardOpacity.value = withTiming(0, { duration: 150 }, () => {
              runOnJS(onSwipe)('down');
            });
          }
        );
        break;
    }
  };

  const resetPosition = () => {
    'worklet';
    translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
    translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    cardRotation.value = withSpring(0, { damping: 15, stiffness: 150 });
    cardOpacity.value = withTiming(1, { duration: 200 });
    cardScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .activeOffsetY([-15, 15])
    .onUpdate((e) => {
      if (isAnimating.value || isLongPressing.value) return;
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      // Slight rotation following horizontal drag
      cardRotation.value = e.translationX * 0.05;
    })
    .onEnd((e) => {
      if (isAnimating.value || isLongPressing.value) return;

      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);
      const velX = Math.abs(e.velocityX);
      const velY = Math.abs(e.velocityY);

      // Determine dominant axis
      const isHorizontal = absX > absY;
      const isVertical = absY > absX;

      if (
        isHorizontal &&
        e.translationX > 0 &&
        (absX > SWIPE_THRESHOLD || velX > VELOCITY_THRESHOLD)
      ) {
        animateExit('right');
      } else if (
        isHorizontal &&
        e.translationX < 0 &&
        (absX > SWIPE_THRESHOLD || velX > VELOCITY_THRESHOLD)
      ) {
        animateExit('left');
      } else if (
        isVertical &&
        e.translationY < 0 &&
        (absY > SWIPE_THRESHOLD || velY > VELOCITY_THRESHOLD)
      ) {
        animateExit('up');
      } else if (
        isVertical &&
        e.translationY > 0 &&
        (absY > SWIPE_THRESHOLD || velY > VELOCITY_THRESHOLD)
      ) {
        animateExit('down');
      } else {
        resetPosition();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(1000)
    .maxDistance(15)
    .onStart(() => {
      runOnJS(onLongPressDismiss)();
    });

  // Pan takes priority — movement activates swipe, stillness activates long-press
  const composed = Gesture.Exclusive(panGesture, longPressGesture);

  // Card drag animation
  const cardAnimatedStyle = useAnimatedStyle(() => {
    // Flip effect: perspective + rotateX based on flipProgress
    const flipRotation = interpolate(flipProgress.value, [0, 1], [90, 0]);

    return {
      transform: [
        { perspective: 1000 },
        { rotateX: `${flipRotation}deg` },
        { translateX: translateX.value + longPressTranslateX.value },
        { translateY: translateY.value + longPressTranslateY.value },
        { rotate: `${cardRotation.value}deg` },
        { scale: cardScale.value },
      ],
      opacity: cardOpacity.value,
    };
  });

  // Direction hint indicators
  const hintRightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 0.8], 'clamp'),
  }));
  const hintLeftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 0.8], 'clamp'),
  }));
  const hintUpStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, -SWIPE_THRESHOLD], [0, 0.8], 'clamp'),
  }));
  const hintDownStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SWIPE_THRESHOLD], [0, 0.8], 'clamp'),
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        {/* Swipe direction hints */}
        <Animated.View style={[styles.hintBadge, styles.hintRight, hintRightStyle]}>
          <Text style={styles.hintText}>&#10003;</Text>
        </Animated.View>
        <Animated.View style={[styles.hintBadge, styles.hintLeft, hintLeftStyle]}>
          <Text style={styles.hintText}>&#8634;</Text>
        </Animated.View>
        <Animated.View style={[styles.hintBadge, styles.hintUp, hintUpStyle]}>
          <Text style={styles.hintText}>&#10007;</Text>
        </Animated.View>
        <Animated.View style={[styles.hintBadge, styles.hintDown, hintDownStyle]}>
          <Text style={styles.hintText}>&#9618;</Text>
        </Animated.View>

        {/* Card content — centered vertically and horizontally */}
        <View style={styles.cardContent}>
          <Text style={styles.title}>{card.title}</Text>

          {card.content.map((block, i) => {
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

          {card.timer && (
            <TimerOverlay durationSeconds={card.timer.durationSeconds} />
          )}

          {card.link && (
            <Text style={styles.linkText}>{card.link}</Text>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    position: 'absolute',
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    marginBottom: 12,
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 12,
  },
  linkText: {
    fontSize: 14,
    color: '#4A90D9',
    textAlign: 'center',
    marginTop: 8,
  },
  // Hint badges
  hintBadge: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  hintRight: {
    top: 16,
    right: 16,
    backgroundColor: '#4CAF50',
  },
  hintLeft: {
    top: 16,
    left: 16,
    backgroundColor: '#FF9800',
  },
  hintUp: {
    top: 16,
    left: '50%',
    marginLeft: -24,
    backgroundColor: '#F44336',
  },
  hintDown: {
    bottom: 16,
    left: '50%',
    marginLeft: -24,
    backgroundColor: '#9C27B0',
  },
  hintText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
});
