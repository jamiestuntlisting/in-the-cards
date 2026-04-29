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
} from './design/tokens';
import {
  HeartIcon,
  SpadeIcon,
  DiamondIcon,
  ClubIcon,
} from './design/icons';

export type SwipeDirection = 'right' | 'left' | 'up' | 'down';

interface SwipeableCardProps {
  card: CardData;
  onSwipe: (direction: SwipeDirection) => void;
  onLongPress: () => void;
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
  onLongPress,
  flipProgress,
}: SwipeableCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardRotation = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);
  const isAnimating = useSharedValue(false);

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
        translateY.value = withTiming(-SCREEN_HEIGHT - 200, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
        cardOpacity.value = withTiming(0, { duration }, () => {
          runOnJS(onSwipe)('up');
        });
        break;

      case 'left':
        translateX.value = withTiming(
          -120,
          { duration: 200, easing: Easing.out(Easing.cubic) },
          () => {
            translateX.value = withSpring(0, { damping: 12, stiffness: 100 });
            translateY.value = withTiming(20, { duration: 200 });
            cardScale.value = withTiming(0.95, { duration: 300 }, () => {
              cardOpacity.value = withTiming(0, { duration: 100 }, () => {
                runOnJS(onSwipe)('left');
              });
            });
          }
        );
        break;

      case 'down':
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
      cardRotation.value = e.translationX * 0.05;
    })
    .onEnd((e) => {
      if (isAnimating.value || isLongPressing.value) return;

      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);
      const velX = Math.abs(e.velocityX);
      const velY = Math.abs(e.velocityY);

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
    .minDuration(500)
    .maxDistance(15)
    .onStart(() => {
      runOnJS(onLongPress)();
    });

  const composed = Gesture.Exclusive(panGesture, longPressGesture);

  const cardAnimatedStyle = useAnimatedStyle(() => {
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

  const hintRightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 0.9], 'clamp'),
  }));
  const hintLeftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 0.9], 'clamp'),
  }));
  const hintUpStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, -SWIPE_THRESHOLD], [0, 0.9], 'clamp'),
  }));
  const hintDownStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SWIPE_THRESHOLD], [0, 0.9], 'clamp'),
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        {/* Suit corner mark (top-left, decorative — no swipe direction bias) */}
        <View style={styles.cornerSuit}>
          <HeartIcon size={16} color={suit.heart} strokeWidth={1.5} />
        </View>

        {/* Swipe direction hints (suit glyphs) */}
        <Animated.View
          style={[styles.hintBadge, styles.hintRight, hintRightStyle]}
        >
          <HeartIcon size={26} color="#fff" strokeWidth={2} />
        </Animated.View>
        <Animated.View
          style={[styles.hintBadge, styles.hintLeft, hintLeftStyle]}
        >
          <DiamondIcon size={26} color="#fff" strokeWidth={2} />
        </Animated.View>
        <Animated.View style={[styles.hintBadge, styles.hintUp, hintUpStyle]}>
          <SpadeIcon size={26} color="#fff" strokeWidth={2} />
        </Animated.View>
        <Animated.View
          style={[styles.hintBadge, styles.hintDown, hintDownStyle]}
        >
          <ClubIcon size={26} color="#fff" strokeWidth={2} />
        </Animated.View>

        {/* Card content */}
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

          {card.link && <Text style={styles.linkText}>{card.link}</Text>}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: color.cardStroke, // 1px ink @ 12% — tentpole detail
    position: 'absolute',
    overflow: 'hidden',
    ...shadow.card,
  },
  cornerSuit: {
    position: 'absolute',
    top: space[3],
    left: space[3],
    zIndex: 1,
    opacity: 0.85,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[6],
    paddingTop: space[8], // leave room for corner suit
  },
  title: {
    fontFamily: font.display,
    fontSize: fontSize.displayL,
    fontWeight: fontWeight.regular,
    color: color.fg1,
    letterSpacing: letterSpacing.display,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: space[4],
    lineHeight: fontSize.displayL * lineHeight.display,
  },
  bodyText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyL,
    lineHeight: fontSize.bodyL * lineHeight.body,
    color: color.fg2,
    marginBottom: space[3],
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: radius.s,
    marginBottom: space[3],
  },
  linkText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.link,
    marginTop: space[2],
    textAlign: 'center',
  },
  // Hint badges — each in the suit's color
  hintBadge: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...shadow.lift,
  },
  hintRight: {
    top: '50%',
    right: space[5],
    marginTop: -28,
    backgroundColor: suit.heart,
  },
  hintLeft: {
    top: '50%',
    left: space[5],
    marginTop: -28,
    backgroundColor: suit.diamond,
  },
  hintUp: {
    top: space[5],
    left: '50%',
    marginLeft: -28,
    backgroundColor: suit.spade,
  },
  hintDown: {
    bottom: space[5],
    left: '50%',
    marginLeft: -28,
    backgroundColor: suit.club,
  },
});
