import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Dimensions,
  Platform,
  ScrollView,
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

interface Props {
  index: number;
  totalRows: number;
  rowHeight: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Reference to the outer ScrollView — enables auto-scroll when dragging
   *  near the top/bottom of the viewport. */
  scrollRef?: React.RefObject<ScrollView | null>;
  /** Ref holding the ScrollView's current scrollTop (updated by onScroll). */
  scrollOffsetRef?: React.RefObject<number>;
  children: React.ReactNode;
}

const AUTO_SCROLL_EDGE = 100; // pixels from viewport edge
const AUTO_SCROLL_MAX_SPEED = 14; // pixels per frame at the very edge

export default function DraggableCardRow({
  index,
  totalRows,
  rowHeight,
  onReorder,
  scrollRef,
  scrollOffsetRef,
  children,
}: Props) {
  // Two separate translation sources that get summed in the animated style:
  //   dragTranslateY     — gesture's finger-relative translation
  //   scrollCompensation — pixels scrolled during drag, added so the row
  //                         stays pinned under the finger
  const dragTranslateY = useSharedValue(0);
  const scrollCompensation = useSharedValue(0);
  const scale = useSharedValue(1);

  // isDragging drives the static zIndex + drop-shadow via React state rather
  // than useAnimatedStyle. On web, Reanimated writes CSS directly; a dynamic
  // undefined boxShadow from a worklet left the row in a broken layout state.
  const [isDragging, setIsDragging] = useState(false);

  // JS-side refs so the auto-scroll rAF loop can read without re-rendering
  const pointerYRef = useRef(0);
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const stopAutoScroll = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startAutoScroll = () => {
    if (!scrollRef?.current || !scrollOffsetRef) return;
    if (Platform.OS !== 'web') return;
    const loop = () => {
      if (!draggingRef.current) {
        rafRef.current = null;
        return;
      }
      const y = pointerYRef.current;
      const vh = Dimensions.get('window').height;
      let delta = 0;
      if (y < AUTO_SCROLL_EDGE) {
        const t = (AUTO_SCROLL_EDGE - y) / AUTO_SCROLL_EDGE;
        delta = -Math.ceil(
          AUTO_SCROLL_MAX_SPEED * Math.min(Math.max(t, 0), 1)
        );
      } else if (y > vh - AUTO_SCROLL_EDGE) {
        const t = (y - (vh - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE;
        delta = Math.ceil(
          AUTO_SCROLL_MAX_SPEED * Math.min(Math.max(t, 0), 1)
        );
      }
      if (delta !== 0 && scrollRef.current) {
        const prevY = scrollOffsetRef.current ?? 0;
        const targetY = Math.max(0, prevY + delta);
        const actualDelta = targetY - prevY;
        if (actualDelta !== 0) {
          scrollRef.current.scrollTo({ y: targetY, animated: false });
          // Pre-update the ref so the next frame reads the new value without
          // waiting for the onScroll callback to fire.
          scrollOffsetRef.current = targetY;
          // Compensate: add the scrolled distance to the row's translation
          // so it stays pinned under the finger on screen.
          scrollCompensation.value = scrollCompensation.value + actualDelta;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const onDragStartJS = () => {
    setIsDragging(true);
    draggingRef.current = true;
    startAutoScroll();
  };

  const onDragEndJS = (fromIndex: number, toIndex: number) => {
    draggingRef.current = false;
    stopAutoScroll();
    setIsDragging(false);
    if (fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
  };

  const updatePointerJS = (y: number) => {
    pointerYRef.current = y;
  };

  const pan = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((e) => {
      'worklet';
      cancelAnimation(dragTranslateY);
      cancelAnimation(scrollCompensation);
      cancelAnimation(scale);
      dragTranslateY.value = 0;
      scrollCompensation.value = 0;
      scale.value = withSpring(1.04, { damping: 14, stiffness: 220 });
      runOnJS(updatePointerJS)(e.absoluteY);
      runOnJS(onDragStartJS)();
    })
    .onUpdate((e) => {
      'worklet';
      dragTranslateY.value = e.translationY;
      runOnJS(updatePointerJS)(e.absoluteY);
    })
    .onEnd((e) => {
      'worklet';
      // Total vertical distance travelled = finger movement + auto-scroll compensation
      const totalTravel = e.translationY + scrollCompensation.value;
      const deltaRows = Math.round(totalTravel / rowHeight);
      const targetIndex = Math.max(
        0,
        Math.min(totalRows - 1, index + deltaRows)
      );

      dragTranslateY.value = withTiming(0, { duration: 180 });
      scrollCompensation.value = withTiming(0, { duration: 180 });
      scale.value = withSpring(1, { damping: 18, stiffness: 220 });

      runOnJS(onDragEndJS)(index, targetIndex);
    })
    .onFinalize(() => {
      'worklet';
      // Safety net if the gesture is cancelled — reset state idempotently
      dragTranslateY.value = withTiming(0, { duration: 180 });
      scrollCompensation.value = withTiming(0, { duration: 180 });
      scale.value = withSpring(1);
      runOnJS(onDragEndJS)(index, index);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragTranslateY.value + scrollCompensation.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[isDragging && styles.dragging, animStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  dragging: {
    zIndex: 100,
    boxShadow: '0px 12px 32px rgba(40, 28, 20, 0.18)',
    cursor: 'grabbing',
  } as any,
});
