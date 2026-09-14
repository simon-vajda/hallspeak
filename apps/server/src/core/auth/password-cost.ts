export interface ScryptCost {
  n: number;
  r: number;
  p: number;
}

/**
 * OWASP's N=2^15/r=8/p=3 pairing, equivalent to the headline N=2^17/r=8/p=1 at a quarter
 * of the memory. Each verification allocates 128*N*r, and on a 2 GB NAS that allocation is
 * the lever worth pulling, not the iteration count.
 */
export const PASSWORD_COST: ScryptCost = { n: 32_768, r: 8, p: 3 };
