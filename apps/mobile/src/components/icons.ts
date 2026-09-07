// Per-icon subpaths rather than the package barrel: the barrel is every lucide glyph, and
// Metro would carry all of them into the bundle.
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Flashlight from 'lucide-react-native/icons/flashlight';
import FlashlightOff from 'lucide-react-native/icons/flashlight-off';
import Link from 'lucide-react-native/icons/link';
import MessageSquareWarning from 'lucide-react-native/icons/message-square-warning';
import Pin from 'lucide-react-native/icons/pin';
import Play from 'lucide-react-native/icons/play';
import QrCode from 'lucide-react-native/icons/qr-code';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Speaker from 'lucide-react-native/icons/speaker';
import Trash from 'lucide-react-native/icons/trash';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Volume2 from 'lucide-react-native/icons/volume-2';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import X from 'lucide-react-native/icons/x';
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

export type IconProps = SvgProps & { size?: number; color?: string; strokeWidth?: number };

/**
 * The glyphs drawn in the design mockups are hand approximations of this set; the library
 * ships the real geometry. Naming them by role rather than re-exporting lucide keeps a call
 * site from reaching for a glyph the design never chose.
 */
export const icons = {
  scan: QrCode,
  link: Link,
  pin: Pin,
  remove: Trash,
  forward: ChevronRight,
  back: ArrowLeft,
  close: X,
  torchOn: Flashlight,
  torchOff: FlashlightOff,
  listen: Play,
  audio: SlidersHorizontal,
  report: MessageSquareWarning,
  volume: Volume2,
  output: Speaker,
  confirm: Check,
  warn: TriangleAlert,
  retry: RefreshCw,
  unreachable: WifiOff,
} as const satisfies Record<string, ComponentType<IconProps>>;

export type IconName = keyof typeof icons;
