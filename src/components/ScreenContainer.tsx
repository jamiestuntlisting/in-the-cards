import React from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { color } from '../design/tokens';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Outer shell that:
 *  - Fills the screen with page background
 *  - On wide viewports (desktop), centers content in a max-500px column
 *    (roughly 50% of a standard desktop screen — a phone-app shape)
 */
export default function ScreenContainer({ children, style }: Props) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: color.bgPage,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    backgroundColor: color.bgPage,
  },
});
