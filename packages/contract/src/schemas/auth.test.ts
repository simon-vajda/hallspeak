import { describe, expect, it } from 'vitest';
import { LoginBody, SetupBody } from './auth';

describe('SetupBody', () => {
  it('accepts a password meeting every rule', () => {
    expect(SetupBody.safeParse({ username: 'admin', password: 'hunter2!' }).success).toBe(true);
  });

  it.each([
    ['too short', 'h2!x'],
    ['no number', 'hunterrr!'],
    ['no special character', 'hunter2xy'],
  ])('rejects a password failing exactly one rule (%s)', (_name, password) => {
    expect(SetupBody.safeParse({ username: 'admin', password }).success).toBe(false);
  });

  it('rejects an empty username', () => {
    expect(SetupBody.safeParse({ username: '', password: 'hunter2!' }).success).toBe(false);
  });
});

describe('LoginBody', () => {
  it('does not apply the password rules, so a pre-existing password still signs in', () => {
    expect(LoginBody.safeParse({ username: 'admin', password: 'short' }).success).toBe(true);
  });

  it('still requires both fields', () => {
    expect(LoginBody.safeParse({ username: 'admin', password: '' }).success).toBe(false);
  });

  it('caps the password body before it reaches scrypt', () => {
    expect(LoginBody.safeParse({ username: 'admin', password: 'x'.repeat(129) }).success).toBe(
      false,
    );
  });
});
