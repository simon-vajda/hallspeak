// Per-icon subpaths rather than the package barrel: the barrel is every lucide glyph, and
// Metro would carry all of them into the bundle.
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Check from 'lucide-react-native/icons/check';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Flashlight from 'lucide-react-native/icons/flashlight';
import FlashlightOff from 'lucide-react-native/icons/flashlight-off';
import Headphones from 'lucide-react-native/icons/headphones';
import Link from 'lucide-react-native/icons/link';
import Link2Off from 'lucide-react-native/icons/link-2-off';
import MessageCircleWarning from 'lucide-react-native/icons/message-circle-warning';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';
import QrCode from 'lucide-react-native/icons/qr-code';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Speaker from 'lucide-react-native/icons/speaker';
import Star from 'lucide-react-native/icons/star';
import SunMoon from 'lucide-react-native/icons/sun-moon';
import Trash from 'lucide-react-native/icons/trash';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Volume2 from 'lucide-react-native/icons/volume-2';
import VolumeX from 'lucide-react-native/icons/volume-x';
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
  appearance: SunMoon,
  scan: QrCode,
  link: Link,
  external: ExternalLink,
  badLink: Link2Off,
  pin: Star,
  remove: Trash,
  forward: ChevronRight,
  back: ArrowLeft,
  backChevron: ChevronLeft,
  close: X,
  torchOn: Flashlight,
  torchOff: FlashlightOff,
  headphones: Headphones,
  listen: Play,
  stop: Pause,
  audio: SlidersHorizontal,
  report: MessageCircleWarning,
  volume: Volume2,
  muted: VolumeX,
  output: Speaker,
  confirm: Check,
  warn: TriangleAlert,
  retry: RefreshCw,
  unreachable: WifiOff,
} as const satisfies Record<string, ComponentType<IconProps>>;

export type IconName = keyof typeof icons;
