import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Card takes 90% of vertical space, aspect ratio 5:7 (standard playing card)
const rawHeight = Math.round(SCREEN_HEIGHT * 0.9);
const rawWidth = Math.round(rawHeight * (5 / 7));

// Clamp width so card doesn't overflow narrow viewports
const maxWidth = SCREEN_WIDTH - 32;
const widthClamped = rawWidth > maxWidth;

export const CARD_WIDTH = widthClamped ? maxWidth : rawWidth;
export const CARD_HEIGHT = widthClamped
  ? Math.round(maxWidth * (7 / 5))
  : rawHeight;
