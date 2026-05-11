import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  Pressable,
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
  /** Body-only press — opens the editor. The drag handle never fires this. */
  onPress?: () => void;
  /** Long-press anywhere on the body also opens the editor. */
  onLongPress?: () => void;
  /** Render-prop for the grip handle. The Pan gesture is wired ONLY to this
   *  node, so vertical scrolling through the rest of the row is undisturbed. */
  handle: React.ReactNode;
  /** The rest of the row content — title, badges, chevron, etc. */
  children: React.ReactNode;
  /** Outer row container style — bg, border, padding live here. */
  rowStyle?: any;
  /** Extra style for the body wrapper (the pressable area). */
  bodyStyle?: any;
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
  onPress,
  onLongPress,
  handle,
  children,
  rowStyle,
  bodyStyle,
}: Props) {
  const dragTranslateY = useSharedValue(0);
  const scrollCompensation = useSharedValue(0);
  const scale = useSharedValue(1);

  const [isDragging, setIsDragging] = useState(false);

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
          scrollOffsetRef.current = targetY;
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

  // Drag is wired to the grip handle only. minDistance disambiguates a tap
  // on the grip from a real drag — the row stays still until the finger moves
  // a couple of pixels, so accidental brushes don't lift the row.
  const pan = Gesture.Pan()
    .minDistance(2)
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
    <Animated.View style={[isDragging && styles.dragging, animStyle]}>
      <View style={[styles.row, rowStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.handleWrap}>{handle}</View>
        </GestureDetector>
        <Pressable
          style={[styles.body, bodyStyle]}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={300}
        >
          {children}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  handleWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    // Stretch the touch surface to the row's full cross-axis so the grip is
    // comfortable to grab even on small phones.
    alignSelf: 'stretch',
    // Web-only cursor hint — `as any` because RN types don't include `cursor`.
    cursor: 'grab',
    // Block native vertical-scroll capture so the gesture handler can claim
    // the touch as a drag instead of the page scrolling.
    touchAction: 'none',
  } as any,
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragging: {
    zIndex: 100,
    boxShadow: '0px 12px 32px rgba(40, 28, 20, 0.18)',
    cursor: 'grabbing',
  } as any,
});
