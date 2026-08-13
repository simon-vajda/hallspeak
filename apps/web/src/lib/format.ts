/** The design prints a PIN grouped 3+3; the wire never carries the space. */
export function formatPin(pin: string) {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

/** `1 channel` / `2 channels`, for copy that counts something. */
export function plural(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
