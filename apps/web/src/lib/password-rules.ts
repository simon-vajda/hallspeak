import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_NUMBER_PATTERN,
  PASSWORD_SPECIAL_PATTERN,
} from '@linguacast/contract/patterns';

export interface PasswordRule {
  id: 'length' | 'number' | 'special';
  label: string;
  satisfied: boolean;
}

/**
 * The three lines the checklist draws, in the order it draws them. Read from the contract's
 * constants, which the server's own schema reads too, so the checklist cannot promise a
 * password the API will refuse.
 */
export function evaluatePassword(password: string): PasswordRule[] {
  return [
    {
      id: 'length',
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      satisfied: password.length >= PASSWORD_MIN_LENGTH,
    },
    { id: 'number', label: 'One number', satisfied: PASSWORD_NUMBER_PATTERN.test(password) },
    {
      id: 'special',
      label: 'One special character',
      satisfied: PASSWORD_SPECIAL_PATTERN.test(password),
    },
  ];
}

export function canFinishSetup(password: string, confirmation: string): boolean {
  return password === confirmation && evaluatePassword(password).every((rule) => rule.satisfied);
}
