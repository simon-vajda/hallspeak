import { describe, expect, it } from 'vitest';
import type { PreflightAction } from '@/components/speaker/speaker-studio-state';
import {
  ANOTHER_INTERPRETER,
  CANCEL_REQUEST,
  END_WITH_HANDOVER,
  formatCountdown,
  HAND_OVER,
  HANDING_OVER_NOTE,
  HANDING_OVER_TITLE,
  HANDOVER_FAILED,
  HANDOVER_REQUEST_TITLE,
  handoverRequestNote,
  otherInterpreterLive,
  preflightActionLabel,
  preflightBadgeLabel,
  preflightNote,
} from './handover-copy';

const ACTIONS: PreflightAction['type'][] = [
  'go-live',
  'ready',
  'waiting',
  'take-over',
  'pending-elsewhere',
  'unknown',
];

const EVERY_STRING = [
  ...ACTIONS.map(preflightBadgeLabel),
  ...ACTIONS.map(preflightActionLabel),
  ...ACTIONS.map(preflightNote).filter((note) => note !== null),
  CANCEL_REQUEST,
  HANDOVER_REQUEST_TITLE,
  handoverRequestNote(false),
  handoverRequestNote(true),
  HAND_OVER,
  HANDING_OVER_TITLE,
  HANDING_OVER_NOTE,
  END_WITH_HANDOVER,
  HANDOVER_FAILED,
];

describe('handover copy', () => {
  it('never claims anybody is hearing the audio', () => {
    const copy = EVERY_STRING.join(' ');
    expect(copy).not.toMatch(/listener|listening|hearing|hears|audience|everyone|everybody/i);
  });

  it('reads an unknown channel as unknown rather than as off air', () => {
    expect(preflightBadgeLabel('unknown')).toBe('Channel status unknown');
    expect(preflightNote('unknown')).not.toMatch(/off air|nobody|no one/i);
    expect(preflightActionLabel('unknown')).not.toBe(preflightActionLabel('go-live'));
  });

  it('offers Go live only when this studio may take the channel', () => {
    expect(preflightActionLabel('go-live')).toBe('Go live');
    for (const action of ACTIONS.filter((candidate) => candidate !== 'go-live')) {
      expect(preflightActionLabel(action)).not.toMatch(/^Go live$/);
    }
  });

  it('says another interpreter is on air for every action but Go live and unknown', () => {
    for (const action of ACTIONS) {
      const other = otherInterpreterLive(action);
      expect(other).toBe(action !== 'go-live' && action !== 'unknown');
      expect(preflightBadgeLabel(action) === ANOTHER_INTERPRETER).toBe(other);
    }
  });

  it('gives each pre-flight action its own action label', () => {
    expect(new Set(ACTIONS.map(preflightActionLabel)).size).toBe(ACTIONS.length);
  });

  it('changes the request note once the deadline has passed', () => {
    expect(handoverRequestNote(false)).not.toBe(handoverRequestNote(true));
    expect(handoverRequestNote(true)).toMatch(/now/);
  });

  it('renders the countdown as whole seconds remaining', () => {
    expect(formatCountdown(30_000)).toBe('0:30');
    expect(formatCountdown(1)).toBe('0:01');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-500)).toBe('0:00');
    expect(formatCountdown(60_000)).toBe('1:00');
    expect(formatCountdown(90_500)).toBe('1:31');
  });
});
