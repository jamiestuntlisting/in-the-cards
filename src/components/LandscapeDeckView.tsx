import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import type { Card } from '../data/types';
import { isCardRetired } from '../data/types';
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

interface Props {
  cards: Card[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onCardPress: (cardId: string) => void;
  /** Disable drag if deck is in random order mode. */
  reorderEnabled: boolean;
}

const GAP = space[4];
const HORIZONTAL_PADDING = space[5];
const AUTO_SCROLL_EDGE = 80;
const AUTO_SCROLL_MAX_SPEED = 18;

export default function LandscapeDeckView({
  cards,
  onReorder,
  onCardPress,
  reorderEnabled,
}: Props) {
  const { height: vh, width: vw } = useWindowDimensions();
  // Card sized to fit landscape height with breathing room. 5:7 aspect.
  const cardHeight = Math.min(Math.round(vh * 0.78), 420);
  const cardWidth = Math.round(cardHeight * (5 / 7));
  const stepX = cardWidth + GAP;

  const scrollRef = useRef<ScrollView | null>(null);
  const scrollOffsetRef = useRef(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  return (
    <View style={styles.root}>
      {reorderEnabled && cards.length > 1 && (
        <Text style={styles.hint}>Long-press a card and drag to reorder.</Text>
      )}
      <ScrollView
        ref={scrollRef}
        horizontal
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: HORIZONTAL_PADDING, gap: GAP },
        ]}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
      >
        {cards.map((card, index) => (
          <DraggableLandscapeCard
            key={card.id}
            card={card}
            index={index}
            totalCards={cards.length}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            stepX={stepX}
            reorderEnabled={reorderEnabled}
            onPress={() => onCardPress(card.id)}
            onReorder={onReorder}
            scrollRef={scrollRef}
            scrollOffsetRef={scrollOffsetRef}
            setScrollEnabled={setScrollEnabled}
            viewportWidth={vw}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface CardProps {
  card: Card;
  index: number;
  totalCards: number;
  cardWidth: number;
  cardHeight: number;
  stepX: number;
  reorderEnabled: boolean;
  onPress: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  scrollRef: React.RefObject<ScrollView | null>;
  scrollOffsetRef: React.RefObject<number>;
  setScrollEnabled: (v: boolean) => void;
  viewportWidth: number;
}

function DraggableLandscapeCard({
  card,
  index,
  totalCards,
  cardWidth,
  cardHeight,
  stepX,
  reorderEnabled,
  onPress,
  onReorder,
  scrollRef,
  scrollOffsetRef,
  setScrollEnabled,
  viewportWidth,
}: CardProps) {
  const dragX = useSharedValue(0);
  const scrollCompensation = useSharedValue(0);
  const scale = useSharedValue(1);

  const [dragging, setDragging] = useState(false);

  const pointerXRef = useRef(0);
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const stopAutoScroll = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startAutoScroll = () => {
    if (!scrollRef.current) return;
    if (Platform.OS !== 'web') return;
    const loop = () => {
      if (!draggingRef.current) {
        rafRef.current = null;
        return;
      }
      const x = pointerXRef.current;
      let delta = 0;
      if (x < AUTO_SCROLL_EDGE) {
        const t = (AUTO_SCROLL_EDGE - x) / AUTO_SCROLL_EDGE;
        delta = -Math.ceil(AUTO_SCROLL_MAX_SPEED * Math.min(Math.max(t, 0), 1));
      } else if (x > viewportWidth - AUTO_SCROLL_EDGE) {
        const t = (x - (viewportWidth - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE;
        delta = Math.ceil(AUTO_SCROLL_MAX_SPEED * Math.min(Math.max(t, 0), 1));
      }
      if (delta !== 0 && scrollRef.current) {
        const prevX = scrollOffsetRef.current ?? 0;
        const targetX = Math.max(0, prevX + delta);
        const actualDelta = targetX - prevX;
        if (actualDelta !== 0) {
          scrollRef.current.scrollTo({ x: targetX, animated: false });
          scrollOffsetRef.current = targetX;
          scrollCompensation.value = scrollCompensation.value + actualDelta;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const onDragStartJS = () => {
    setDragging(true);
    setScrollEnabled(false);
    draggingRef.current = true;
    startAutoScroll();
  };

  const onDragEndJS = (fromIndex: number, toIndex: number) => {
    draggingRef.current = false;
    stopAutoScroll();
    setDragging(false);
    setScrollEnabled(true);
    if (fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
  };

  const updatePointerJS = (x: number) => {
    pointerXRef.current = x;
  };

  // Pan gesture activates only after a long-press hold so it doesn't fight
  // horizontal scroll. While dragging, the parent ScrollView is disabled.
  const pan = Gesture.Pan()
    .enabled(reorderEnabled)
    .activateAfterLongPress(280)
    .onStart((e) => {
      'worklet';
      cancelAnimation(dragX);
      cancelAnimation(scrollCompensation);
      cancelAnimation(scale);
      dragX.value = 0;
      scrollCompensation.value = 0;
      scale.value = withSpring(1.06, { damping: 14, stiffness: 220 });
      runOnJS(updatePointerJS)(e.absoluteX);
      runOnJS(onDragStartJS)();
    })
    .onUpdate((e) => {
      'worklet';
      dragX.value = e.translationX;
      runOnJS(updatePointerJS)(e.absoluteX);
    })
    .onEnd((e) => {
      'worklet';
      const totalTravel = e.translationX + scrollCompensation.value;
      const deltaCols = Math.round(totalTravel / stepX);
      const target = Math.max(0, Math.min(totalCards - 1, index + deltaCols));

      dragX.value = withTiming(0, { duration: 180 });
      scrollCompensation.value = withTiming(0, { duration: 180 });
      scale.value = withSpring(1, { damping: 18, stiffness: 220 });

      runOnJS(onDragEndJS)(index, target);
    })
    .onFinalize(() => {
      'worklet';
      dragX.value = withTiming(0, { duration: 180 });
      scrollCompensation.value = withTiming(0, { duration: 180 });
      scale.value = withSpring(1);
      runOnJS(onDragEndJS)(index, index);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value + scrollCompensation.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          { width: cardWidth, height: cardHeight },
          dragging && styles.dragging,
          animStyle,
        ]}
      >
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.cardOuter,
            pressed && !dragging && styles.cardPressed,
          ]}
        >
          <CardFace card={card} cardWidth={cardWidth} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function CardFace({ card, cardWidth }: { card: Card; cardWidth: number }) {
  const retired = isCardRetired(card);
  const remaining =
    card.completionLimit != null
      ? Math.max(0, card.completionLimit - (card.completionCount ?? 0))
      : null;

  return (
    <View style={[styles.card, retired && styles.cardRetired]}>
      <View style={styles.cornerSuit}>
        <HeartIcon size={16} color={suit.heart} strokeWidth={1.5} />
      </View>

      <View style={styles.cardContent}>
        <Text
          style={[
            styles.title,
            retired && styles.titleRetired,
            // Scale title down on narrow cards so it doesn't overflow
            cardWidth < 240 && { fontSize: fontSize.bodyL },
          ]}
          numberOfLines={4}
        >
          {card.title}
        </Text>

        {card.content?.slice(0, 2).map((block, i) => {
          if (block.type !== 'text' || !block.value.trim()) return null;
          return (
            <Text key={i} style={styles.bodyText} numberOfLines={3}>
              {block.value}
            </Text>
          );
        })}

        <View style={styles.badgeRow}>
          {card.timer && (
            <View style={styles.timerBadge}>
              <TimerIcon size={12} color={suit.club} strokeWidth={2} />
              <Text style={styles.timerText}>
                {card.timer.durationSeconds}s
              </Text>
            </View>
          )}
          {card.completionLimit != null && (
            <View
              style={[
                styles.limitBadge,
                retired && styles.limitBadgeDone,
              ]}
            >
              <Text
                style={[
                  styles.limitBadgeText,
                  retired && styles.limitBadgeDoneText,
                ]}
              >
                {retired
                  ? 'Done'
                  : card.completionLimit === 1
                  ? 'Once'
                  : `${remaining} left`}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: space[2],
  },
  hint: {
    fontFamily: font.text,
    fontSize: fontSize.micro,
    color: color.fgOnFelt3,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: space[2],
    fontStyle: 'italic',
    textAlign: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: space[3],
  },
  cardOuter: {
    flex: 1,
    borderRadius: radius.l,
    // touchAction:none so web pointer events flow to gesture handler
    touchAction: 'pan-y',
  } as any,
  cardPressed: {
    opacity: 0.94,
  },
  card: {
    flex: 1,
    backgroundColor: color.bgRaised,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: color.cardStroke,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardRetired: {
    opacity: 0.55,
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
  titleRetired: {
    textDecorationLine: 'line-through',
    color: color.fg3,
  },
  bodyText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    lineHeight: fontSize.bodyS * lineHeight.body,
    color: color.fg2,
    marginBottom: space[2],
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: suitTint.club,
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  timerText: {
    fontFamily: font.mono,
    fontSize: fontSize.label,
    color: suit.club,
    fontWeight: fontWeight.medium,
  },
  limitBadge: {
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.xs,
    backgroundColor: suitTint.diamond,
  },
  limitBadgeText: {
    fontFamily: font.mono,
    fontSize: fontSize.label,
    color: suit.diamond,
    fontWeight: fontWeight.medium,
  },
  limitBadgeDone: {
    backgroundColor: color.hairline,
  },
  limitBadgeDoneText: {
    color: color.fg4,
  },
  dragging: {
    zIndex: 100,
    boxShadow:
      '0px 16px 36px rgba(40, 28, 20, 0.28), 0px 4px 10px rgba(40, 28, 20, 0.12)',
    cursor: 'grabbing',
  } as any,
});
