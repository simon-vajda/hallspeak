import { describe, expect, it } from 'vitest';
import { semverLt } from './semver';

describe('semverLt', () => {
  it('is false for equal versions', () => {
    expect(semverLt('1.2.3', '1.2.3')).toBe(false);
  });

  it('compares across the major boundary', () => {
    expect(semverLt('0.9.9', '1.0.0')).toBe(true);
    expect(semverLt('1.0.0', '0.9.9')).toBe(false);
  });

  it('compares across the minor boundary', () => {
    expect(semverLt('1.1.9', '1.2.0')).toBe(true);
    expect(semverLt('1.2.0', '1.1.9')).toBe(false);
  });

  it('compares across the patch boundary', () => {
    expect(semverLt('1.2.3', '1.2.4')).toBe(true);
    expect(semverLt('1.2.4', '1.2.3')).toBe(false);
  });

  it('compares numerically, not lexically', () => {
    expect(semverLt('1.10.0', '1.9.0')).toBe(false);
    expect(semverLt('1.9.0', '1.10.0')).toBe(true);
  });
});
