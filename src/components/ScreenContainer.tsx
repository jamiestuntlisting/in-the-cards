import React from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { color } from '../design/tokens';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Optional background override — applied to both outer and inner layers
   *  so the wide-viewport sides match the phone column. */
  bg?: string;
}

/**
 * Outer shell that:
 *  - Fills the screen with page background
 *  - On wide viewports (desktop), centers content in a max-500px column
 *    (roughly 50% of a standard desktop screen — a phone-app shape)
 */
export default function ScreenContainer({ children, style, bg }: Props) {
  const bgStyle = bg ? { backgroundColor: bg } : null;
  return (
    <View style={[styles.outer, bgStyle]}>
      <View style={[styles.inner, bgStyle, style]}>{children}</View>
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
