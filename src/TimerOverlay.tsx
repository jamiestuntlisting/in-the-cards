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
import {
  color,
  font,
  fontSize,
  fontWeight,
  radius,
  space,
  suit,
} from './design/tokens';
import { PlayIcon, PauseIcon } from './design/icons';

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
  const progress = useSharedValue(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current === 'active' &&
        nextState.match(/inactive|background/)
      ) {
        if (running) {
          clearTimer();
          setRunning(false);
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [running, clearTimer]);

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

  useEffect(() => {
    if (running) {
      const currentPct = (durationSeconds - remaining) / durationSeconds;
      progress.value = currentPct;
      progress.value = withTiming(1, {
        duration: remaining * 1000,
        easing: Easing.linear,
      });
    } else if (done) {
      progress.value = withTiming(1, { duration: 200 });
    } else {
      progress.value = (durationSeconds - remaining) / durationSeconds;
    }
  }, [running, done, remaining, durationSeconds, progress]);

  useEffect(() => {
    if (remaining === durationSeconds && !running && !done) {
      progress.value = 0;
    }
  }, [remaining, durationSeconds, running, done, progress]);

  useEffect(() => {
    if (!done) return;
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

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  const reset = () => {
    clearTimer();
    setRunning(false);
    setDone(false);
    setRemaining(durationSeconds);
    progress.value = 0;
  };

  return (
    <Animated.View style={[styles.container, blinkStyle]}>
      <Text style={styles.timeText}>{formatTime(remaining)}</Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            done && styles.progressFillDone,
            progressBarStyle,
          ]}
        />
      </View>

      {!done && !running && (
        <Pressable
          style={styles.startButton}
          onPress={() => {
            if (remaining > 0) setRunning(true);
          }}
        >
          <PlayIcon size={14} color="#fff" strokeWidth={2.2} />
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
          <PauseIcon size={14} color="#fff" strokeWidth={2.2} />
          <Text style={styles.startText}>Pause</Text>
        </Pressable>
      )}
      {done && (
        <View style={styles.doneRow}>
          <Text style={styles.doneText}>Time's up!</Text>
          <Pressable onPress={reset}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: space[3],
    padding: space[3],
    backgroundColor: 'rgba(26, 23, 20, 0.04)',
    borderRadius: radius.m,
    minWidth: 200,
  },
  timeText: {
    fontFamily: font.mono,
    fontSize: fontSize.timer,
    fontWeight: fontWeight.medium,
    color: color.fg1,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(26, 23, 20, 0.08)',
    borderRadius: 2,
    marginTop: space[1] + 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: suit.club, // teal for timer
    borderRadius: 2,
  },
  progressFillDone: {
    backgroundColor: suit.heart, // red when done
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space[2] + 2,
    paddingHorizontal: space[5],
    paddingVertical: space[2] + 2,
    backgroundColor: suit.heart,
    borderRadius: radius.xl,
  },
  pauseButton: {
    backgroundColor: color.fg3,
  },
  startText: {
    fontFamily: font.text,
    color: '#fff',
    fontSize: fontSize.ui,
    fontWeight: fontWeight.semibold,
  },
  doneRow: {
    marginTop: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  doneText: {
    fontFamily: font.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: suit.heart,
  },
  resetText: {
    fontFamily: font.text,
    fontSize: fontSize.bodyS,
    color: color.link,
    fontWeight: fontWeight.medium,
  },
});
