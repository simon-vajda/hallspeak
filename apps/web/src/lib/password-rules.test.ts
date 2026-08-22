import { describe, expect, it } from 'vitest';
import { canFinishSetup, evaluatePassword } from './password-rules';

const failing = (password: string) =>
  evaluatePassword(password)
    .filter((rule) => !rule.satisfied)
    .map((rule) => rule.id);

describe('evaluatePassword', () => {
  it('fails only the length rule for a short password that has the rest', () => {
    expect(failing('a1!')).toEqual(['length']);
  });

  it('fails only the number rule for a long password without one', () => {
    expect(failing('correct-horse-battery')).toEqual(['number']);
  });

  it('fails only the special rule for a long password with a digit and nothing else', () => {
    expect(failing('correcthorse1')).toEqual(['special']);
  });

  it('passes every rule for a password that satisfies all three', () => {
    expect(failing('hunter2!x')).toEqual([]);
  });

  it('accepts a space as the special character, so a passphrase is not refused', () => {
    expect(failing('correct horse battery 9')).toEqual([]);
  });

  it('keeps the three lines in the order the design draws them', () => {
    expect(evaluatePassword('').map((rule) => rule.id)).toEqual(['length', 'number', 'special']);
  });
});

describe('canFinishSetup', () => {
  it('refuses while the confirmation differs, even with every rule passing', () => {
    expect(canFinishSetup('hunter2!x', 'hunter2!y')).toBe(false);
  });

  it('refuses an empty pair, which matches itself but satisfies nothing', () => {
    expect(canFinishSetup('', '')).toBe(false);
  });

  it('allows a matching pair that satisfies every rule', () => {
    expect(canFinishSetup('hunter2!x', 'hunter2!x')).toBe(true);
  });

  it('refuses a password above the API safety limit', () => {
    const password = `hunter2!${'x'.repeat(121)}`;

    expect(canFinishSetup(password, password)).toBe(false);
  });
});
