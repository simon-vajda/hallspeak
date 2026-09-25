/// <reference path="./qrcode-core.d.ts" />
// The core entry, so neither bundler sees the package's Node and canvas renderers.
import { create } from 'qrcode/lib/core/qrcode';

export type QrEyeFrame = 'square' | 'rounded' | 'circle';
export type QrEyeBall = 'square' | 'rounded' | 'circle';
export type QrModule = 'square' | 'rounded' | 'dot' | 'fluid';

export type QrStyle = { frame: QrEyeFrame; ball: QrEyeBall; module: QrModule };

export const QR_STYLE: QrStyle = { frame: 'rounded', ball: 'rounded', module: 'fluid' };

/**
 * `path` is in module units (viewBox `0 0 size size`, no quiet zone) and must be filled
 * `evenodd`: each eye is its outer square, the hole cut from it, and the ball inside the hole.
 * `logo` is the square to fit a mark into, in the same units; the modules around it are left
 * empty for `LOGO_PADDING` more on every side, so the mark stands on the code's background.
 */
export type QrDrawing = {
  size: number;
  path: string;
  logo: { offset: number; size: number } | null;
};

/**
 * Share of the code's width the logo may cover. Its area stays under 8%, well inside the 30%
 * that error-correction level H recovers, leaving the rest of that margin for print wear.
 */
const LOGO_RATIO = 0.28;

const LOGO_PADDING = 1;

const EYE = 7;

const FRAME_RADIUS: Record<QrEyeFrame, [outer: number, inner: number]> = {
  square: [0, 0],
  rounded: [2.2, 1.3],
  circle: [3.5, 2.5],
};

const BALL_RADIUS: Record<QrEyeBall, number> = { square: 0, rounded: 0.9, circle: 1.5 };

const MODULE_INSET: Record<Exclude<QrModule, 'fluid'>, [inset: number, radius: number]> = {
  square: [0, 0],
  rounded: [0.05, 0.3],
  dot: [0.02, 0.48],
};

/**
 * A fluid module rounds only the corners no neighbour touches, and fills an inside corner only
 * where three modules wrap it; two meeting at a single point stay apart.
 */
const FLUID_RADIUS = 0.25;

function num(n: number) {
  return String(Math.round(n * 1000) / 1000);
}

function roundedSquare(x: number, y: number, side: number, r: number) {
  if (r === 0) {
    return `M${num(x)} ${num(y)}h${num(side)}v${num(side)}h${num(-side)}z`;
  }

  const edge = num(side - 2 * r);
  const arc = (dx: number, dy: number) => `a${num(r)} ${num(r)} 0 0 1 ${num(dx)} ${num(dy)}`;

  return (
    `M${num(x + r)} ${num(y)}h${edge}${arc(r, r)}v${edge}${arc(-r, r)}` +
    `h${num(-(side - 2 * r))}${arc(-r, -r)}v${num(-(side - 2 * r))}${arc(r, -r)}z`
  );
}

/** Corners run clockwise from the top left; each is square or rounded by `FLUID_RADIUS`. */
function fluidSquare(x: number, y: number, rounded: [boolean, boolean, boolean, boolean]) {
  const radius = (round: boolean) => (round ? FLUID_RADIUS : 0);
  const [tl, tr, br, bl] = [
    radius(rounded[0]),
    radius(rounded[1]),
    radius(rounded[2]),
    radius(rounded[3]),
  ];
  const arc = (r: number, dx: number, dy: number) =>
    r ? `a${num(r)} ${num(r)} 0 0 1 ${num(dx)} ${num(dy)}` : '';

  return (
    `M${num(x + tl)} ${y}h${num(1 - tl - tr)}${arc(tr, tr, tr)}v${num(1 - tr - br)}` +
    `${arc(br, -br, br)}h${num(-(1 - br - bl))}${arc(bl, -bl, -bl)}v${num(-(1 - bl - tl))}` +
    `${arc(tl, tl, -tl)}z`
  );
}

/**
 * The web of an inside corner: a square of `FLUID_RADIUS` in the empty cell's corner at
 * (`x`, `y`), less the quarter circle centred `FLUID_RADIUS` into the cell along (`dx`, `dy`).
 */
function fluidFillet(x: number, y: number, dx: 1 | -1, dy: 1 | -1) {
  const r = FLUID_RADIUS;
  const sweep = dx === dy ? 0 : 1;

  return `M${x} ${y}h${num(dx * r)}a${num(r)} ${num(r)} 0 0 ${sweep} ${num(-dx * r)} ${num(dy * r)}z`;
}

function logoSide(size: number) {
  return Math.round((size * LOGO_RATIO - 1) / 2) * 2 + 1;
}

export function drawQr(
  value: string,
  { style = QR_STYLE, logo = false }: { style?: QrStyle; logo?: boolean } = {},
): QrDrawing {
  const { modules } = create(value, { errorCorrectionLevel: logo ? 'H' : 'M' });
  const { size } = modules;
  const eyes: [number, number][] = [
    [0, 0],
    [size - EYE, 0],
    [0, size - EYE],
  ];
  const inEye = (row: number, col: number) =>
    eyes.some(([x, y]) => col >= x && col < x + EYE && row >= y && row < y + EYE);

  const side = logo ? logoSide(size) : 0;
  const offset = (size - side) / 2;
  const inLogo = (row: number, col: number) =>
    side > 0 && row >= offset && row < offset + side && col >= offset && col < offset + side;

  const [outer, inner] = FRAME_RADIUS[style.frame];
  let path = '';

  for (const [x, y] of eyes) {
    path += roundedSquare(x, y, EYE, outer);
    path += roundedSquare(x + 1, y + 1, EYE - 2, inner);
    path += roundedSquare(x + 2, y + 2, 3, BALL_RADIUS[style.ball]);
  }

  const excluded = (row: number, col: number) => inEye(row, col) || inLogo(row, col);
  const dark = (row: number, col: number) =>
    row >= 0 &&
    col >= 0 &&
    row < size &&
    col < size &&
    modules.get(row, col) === 1 &&
    !excluded(row, col);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (style.module !== 'fluid') {
        if (dark(row, col)) {
          const [inset, radius] = MODULE_INSET[style.module];
          path += roundedSquare(col + inset, row + inset, 1 - 2 * inset, radius);
        }
        continue;
      }

      const up = dark(row - 1, col);
      const down = dark(row + 1, col);
      const left = dark(row, col - 1);
      const right = dark(row, col + 1);

      if (dark(row, col)) {
        path += fluidSquare(col, row, [
          !up && !left,
          !up && !right,
          !down && !right,
          !down && !left,
        ]);
      } else if (!excluded(row, col)) {
        if (up && left && dark(row - 1, col - 1)) {
          path += fluidFillet(col, row, 1, 1);
        }
        if (up && right && dark(row - 1, col + 1)) {
          path += fluidFillet(col + 1, row, -1, 1);
        }
        if (down && right && dark(row + 1, col + 1)) {
          path += fluidFillet(col + 1, row + 1, -1, -1);
        }
        if (down && left && dark(row + 1, col - 1)) {
          path += fluidFillet(col, row + 1, 1, -1);
        }
      }
    }
  }

  return {
    size,
    path,
    logo: side > 0 ? { offset: offset + LOGO_PADDING, size: side - 2 * LOGO_PADDING } : null,
  };
}
