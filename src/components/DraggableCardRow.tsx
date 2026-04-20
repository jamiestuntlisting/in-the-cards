import React, { useRef, useState } from 'react';
import {
  View,
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
  /** Optional: reference to the outer ScrollView. Enables auto-scroll when
   *  the user drags near the top/bottom of the viewport. */
  scrollRef?: React.RefObject<ScrollView | null>;
  /** Optional: ref holding the current scroll offset (updated by onScroll). */
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
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // isDragging drives the static zIndex + drop-shadow via React state rather
  // than useAnimatedStyle. On web, Reanimated writes to the DOM directly;
  // returning an undefined `boxShadow` from a worklet-derived style can leave
  // the row in a broken layout state and crash the page. Keeping those two
  // properties on JS-side state sidesteps that entirely.
  const [isDragging, setIsDragging] = useState(false);

  // Track pointer + drag state on refs so the auto-scroll rAF loop can read
  // them without triggering re-renders.
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
    if (Platform.OS !== 'web') return; // native uses built-in edge-scroll
    const loop = () => {
      if (!draggingRef.current) {
        rafRef.current = null;
        return;
      }
      const y = pointerYRef.current;
      const vh = Dimensions.get('window').height;
      let delta = 0;
      if (y < AUTO_SCROLL_EDGE) {
        const t = (AUTO_SCROLL_EDGE - y) / AUTO_SCROLL_EDGE; // 0..1
        delta = -Math.ceil(AUTO_SCROLL_MAX_SPEED * Math.min(Math.max(t, 0), 1));
      } else if (y > vh - AUTO_SCROLL_EDGE) {
        const t = (y - (vh - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE;
        delta = Math.ceil(AUTO_SCROLL_MAX_SPEED * Math.min(Math.max(t, 0), 1));
      }
      if (delta !== 0 && scrollRef.current) {
        const newY = Math.max(0, (scrollOffsetRef.current ?? 0) + delta);
        scrollRef.current.scrollTo({ y: newY, animated: false });
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
      cancelAnimation(translateY);
      cancelAnimation(scale);
      scale.value = withSpring(1.04, { damping: 14, stiffness: 220 });
      runOnJS(updatePointerJS)(e.absoluteY);
      runOnJS(onDragStartJS)();
    })
    .onUpdate((e) => {
      'worklet';
      translateY.value = e.translationY;
      runOnJS(updatePointerJS)(e.absoluteY);
    })
    .onEnd((e) => {
      'worklet';
      const deltaRows = Math.round(e.translationY / rowHeight);
      const targetIndex = Math.max(
        0,
        Math.min(totalRows - 1, index + deltaRows)
      );

      translateY.value = withTiming(0, { duration: 180 });
      scale.value = withSpring(1, { damping: 18, stiffness: 220 });

      runOnJS(onDragEndJS)(index, targetIndex);
    })
    .onFinalize(() => {
      'worklet';
      // Safety net: if gesture is cancelled, still reset state
      translateY.value = withTiming(0, { duration: 180 });
      scale.value = withSpring(1);
      runOnJS(onDragEndJS)(index, index);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          isDragging && styles.dragging,
          animStyle,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  dragging: {
    zIndex: 100,
    // Warm drop shadow — matches shadow-lift token
    boxShadow: '0px 12px 32px rgba(40, 28, 20, 0.18)',
    cursor: 'grabbing',
  } as any,
});
