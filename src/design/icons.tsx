/**
 * Icon library — Lucide-matched line icons + suit glyphs.
 * 1.75px stroke, 24×24 viewBox, currentColor stroke.
 * Accepts size + color props; default size 24, default color currentColor.
 *
 * Ported from design system SVGs so they render cross-platform via react-native-svg.
 */
import React from 'react';
import Svg, {
  Path,
  Polyline,
  Polygon,
  Line,
  Circle,
  Rect,
} from 'react-native-svg';
import { ink } from './tokens';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const defaults = (p: IconProps) => ({
  width: p.size ?? 24,
  height: p.size ?? 24,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: p.color ?? ink[900],
  strokeWidth: p.strokeWidth ?? 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

// ─── Suit glyphs ───

export const HeartIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
  </Svg>
);

export const SpadeIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Path d="M12 3 C 12 9, 4 11, 4 15 a 4 4 0 0 0 8 1 a 4 4 0 0 0 8 -1 c 0 -4 -8 -6 -8 -12 z" />
    <Path d="M12 16 L 10 21 L 14 21 Z" />
  </Svg>
);

export const DiamondIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Path d="M12 3 L 20 12 L 12 21 L 4 12 Z" />
  </Svg>
);

export const ClubIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Circle cx="12" cy="8" r="3.2" />
    <Circle cx="7.5" cy="14" r="3.2" />
    <Circle cx="16.5" cy="14" r="3.2" />
    <Path d="M12 16 L 10 21 L 14 21 Z" />
  </Svg>
);

// ─── UI icons (Lucide-matched) ───

export const CheckIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

export const SkipIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);

export const DeferIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Path d="M3 12a9 9 0 1 0 3-6.7" />
    <Polyline points="3 4 3 10 9 10" />
  </Svg>
);

export const ShuffleIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Polyline points="16 3 21 3 21 8" />
    <Line x1="4" y1="20" x2="21" y2="3" />
    <Polyline points="21 16 21 21 16 21" />
    <Line x1="15" y1="15" x2="21" y2="21" />
    <Polyline points="8 3 3 3 3 8" />
    <Line x1="3" y1="3" x2="10" y2="10" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Polygon points="6 3 20 12 6 21 6 3" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Rect x="6" y="4" width="4" height="16" />
    <Rect x="14" y="4" width="4" height="16" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const TimerIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Circle cx="12" cy="12" r="9" />
    <Polyline points="12 7 12 12 15 14" />
  </Svg>
);

export const SettingsIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Polyline points="15 18 9 12 15 6" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Polyline points="9 18 15 12 9 6" />
  </Svg>
);

export const FixedOrderIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Line x1="3" y1="6" x2="21" y2="6" />
    <Line x1="3" y1="12" x2="21" y2="12" />
    <Line x1="3" y1="18" x2="21" y2="18" />
  </Svg>
);

export const RandomOrderIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Polyline points="16 3 20 7 16 11" />
    <Path d="M4 7h16" />
    <Polyline points="8 13 4 17 8 21" />
    <Path d="M20 17H4" />
  </Svg>
);

// Extras — used but not in the original set
export const ChevronUpIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Polyline points="18 15 12 9 6 15" />
  </Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...defaults(p)}>
    <Polyline points="6 9 12 15 18 9" />
  </Svg>
);

export const UndoIcon = DeferIcon;
