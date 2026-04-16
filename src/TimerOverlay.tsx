import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface TimerOverlayProps {
  durationSeconds: number;
}

export default function TimerOverlay({ durationSeconds }: TimerOverlayProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const blinkOpacity = useSharedValue(1);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Pause on app background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current === 'active' &&
        nextState.match(/inactive|background/)
      ) {
        // App going to background — pause
        if (running) {
          clearTimer();
          setRunning(false);
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [running, clearTimer]);

  // Tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          setRunning(false);
          setDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [running, clearTimer]);

  // Blink 5 times on done
  useEffect(() => {
    if (!done) return;
    // 5 blinks: opacity goes 1 → 0 → 1 five times
    blinkOpacity.value = withSequence(
      ...Array.from({ length: 5 }).flatMap((_, i) => [
        withDelay(
          i * 400,
          withTiming(0.2, { duration: 150, easing: Easing.inOut(Easing.ease) })
        ),
        withDelay(
          i * 400 + 150,
          withTiming(1, { duration: 150, easing: Easing.inOut(Easing.ease) })
        ),
      ])
    );
  }, [done, blinkOpacity]);

  const blinkStyle = useAnimatedStyle(() => ({
    opacity: blinkOpacity.value,
  }));

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0
      ? `${m}:${sec.toString().padStart(2, '0')}`
      : `${sec}s`;
  };

  return (
    <Animated.View style={[styles.container, blinkStyle]}>
      <Text style={styles.timeText}>{formatTime(remaining)}</Text>
      {!done && !running && (
        <Pressable
          style={styles.startButton}
          onPress={() => {
            if (remaining > 0) setRunning(true);
          }}
        >
          <Text style={styles.startText}>
            {remaining < durationSeconds ? 'Resume' : 'Start'}
          </Text>
        </Pressable>
      )}
      {running && (
        <Pressable
          style={[styles.startButton, styles.pauseButton]}
          onPress={() => {
            clearTimer();
            setRunning(false);
          }}
        >
          <Text style={styles.startText}>Pause</Text>
        </Pressable>
      )}
      {done && <Text style={styles.doneText}>Time's up!</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
  },
  timeText: {
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#333',
  },
  startButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#4A90D9',
    borderRadius: 20,
  },
  pauseButton: {
    backgroundColor: '#888',
  },
  startText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doneText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90D9',
  },
});
