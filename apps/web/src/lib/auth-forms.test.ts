import { PASSWORD_MAX_LENGTH } from '@hallspeak/contract/patterns';
import { describe, expect, it } from 'vitest';
import { changePasswordFormSchema, loginFormSchema, setupFormSchema } from './auth-forms';

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

describe('changePasswordFormSchema', () => {
  const valid = {
    currentPassword: 'hunter2!',
    newPassword: 'correct1!',
    confirmation: 'correct1!',
  };

  it('accepts a matching new password that meets every rule', () => {
    expect(changePasswordFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a current password created before the rules were tightened', () => {
    expect(changePasswordFormSchema.safeParse({ ...valid, currentPassword: 'short' }).success).toBe(
      true,
    );
  });

  it('accepts the current password as the new one', () => {
    expect(
      changePasswordFormSchema.safeParse({
        currentPassword: 'hunter2!',
        newPassword: 'hunter2!',
        confirmation: 'hunter2!',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['required current password', { ...valid, currentPassword: '' }],
    ['number', { ...valid, newPassword: 'correctxx!', confirmation: 'correctxx!' }],
    ['special', { ...valid, newPassword: 'correct11', confirmation: 'correct11' }],
    ['length', { ...valid, newPassword: 'short1!', confirmation: 'short1!' }],
  ])('rejects invalid %s', (_case, values) => {
    expect(changePasswordFormSchema.safeParse(values).success).toBe(false);
  });

  it('reports a mismatched confirmation on the confirmation field', () => {
    const result = changePasswordFormSchema.safeParse({ ...valid, confirmation: 'different1!' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['confirmation']);
  });
});
