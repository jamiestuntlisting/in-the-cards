import React from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface Props {
  index: number;
  totalRows: number;
  rowHeight: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}

/**
 * Wraps a list row with a long-press-to-drag reorder gesture.
 *
 * Behavior:
 *  - Tap passes through to the child (so Pressable onPress still works).
 *  - Long-press (300 ms) activates drag mode — row lifts (scale + shadow + z-index).
 *  - Pan moves the row vertically; target index is computed as
 *    `Math.round(translationY / rowHeight)` offset from the starting index.
 *  - Release snaps the row back to 0 translation and calls onReorder
 *    if the target index differs.
 *
 * The outer ScrollView keeps working because Pan.activateAfterLongPress only
 * activates after the user is stationary for 300ms — normal scroll swipes
 * move too fast to ever trip it.
 */
export default function DraggableCardRow({
  index,
  totalRows,
  rowHeight,
  onReorder,
  children,
}: Props) {
  const translateY = useSharedValue(0);
  const zIndex = useSharedValue(0);
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0);

  const pan = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      'worklet';
      zIndex.value = 100;
      scale.value = withSpring(1.03, { damping: 14, stiffness: 220 });
      shadowOpacity.value = withSpring(1);
    })
    .onUpdate((e) => {
      'worklet';
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      const deltaRows = Math.round(e.translationY / rowHeight);
      const targetIndex = Math.max(
        0,
        Math.min(totalRows - 1, index + deltaRows)
      );

      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
      scale.value = withSpring(1, { damping: 18, stiffness: 220 });
      shadowOpacity.value = withSpring(0);
      zIndex.value = 0;

      if (targetIndex !== index) {
        runOnJS(onReorder)(index, targetIndex);
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
    // Web-only: use boxShadow via a shared value
    boxShadow:
      shadowOpacity.value > 0
        ? `0px ${8 * shadowOpacity.value}px ${
            20 * shadowOpacity.value
          }px rgba(40, 28, 20, ${0.2 * shadowOpacity.value})`
        : undefined,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animStyle}>{children}</Animated.View>
    </GestureDetector>
  );
}
