import { PASSWORD_MAX_LENGTH } from '@linguacast/contract/patterns';
import { describe, expect, it } from 'vitest';
import { loginFormSchema, setupFormSchema } from './auth-forms';

describe('setupFormSchema', () => {
  const valid = { username: 'admin', password: 'hunter2!', confirmation: 'hunter2!' };

  it('accepts matching credentials that meet every password rule', () => {
    expect(setupFormSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['required username', { ...valid, username: '' }],
    ['required password', { ...valid, password: '', confirmation: '' }],
    ['required confirmation', { ...valid, confirmation: '' }],
    ['username ceiling', { ...valid, username: 'x'.repeat(65) }],
    ['length', { ...valid, password: 'short1!', confirmation: 'short1!' }],
    ['number', { ...valid, password: 'hunterxx!', confirmation: 'hunterxx!' }],
    ['special', { ...valid, password: 'hunter22', confirmation: 'hunter22' }],
    ['confirmation', { ...valid, confirmation: 'different2!' }],
  ])('rejects invalid %s', (_case, values) => {
    expect(setupFormSchema.safeParse(values).success).toBe(false);
  });

  it('enforces the request-size ceiling', () => {
    const password = `hunter2!${'x'.repeat(PASSWORD_MAX_LENGTH)}`;
    expect(setupFormSchema.safeParse({ ...valid, password, confirmation: password }).success).toBe(
      false,
    );
  });
});

describe('loginFormSchema', () => {
  it('accepts a legacy password that does not meet current setup rules', () => {
    expect(loginFormSchema.safeParse({ username: 'admin', password: 'short' }).success).toBe(true);
  });

  it('requires both fields and enforces the password ceiling', () => {
    expect(loginFormSchema.safeParse({ username: '', password: 'short' }).success).toBe(false);
    expect(loginFormSchema.safeParse({ username: 'admin', password: '' }).success).toBe(false);
    expect(
      loginFormSchema.safeParse({
        username: 'admin',
        password: 'x'.repeat(PASSWORD_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});
