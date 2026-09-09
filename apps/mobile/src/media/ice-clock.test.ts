import { describe, expect, it } from '@jest/globals';
import { dueDeadlines, stalledSteps } from './ice-clock';

describe('dueDeadlines', () => {
  it('returns nothing while every deadline is still ahead', () => {
    expect(dueDeadlines({ recv: { at: 1_500 } }, 1_000)).toEqual([]);
  });

  it('returns a deadline that has passed', () => {
    expect(dueDeadlines({ recv: { at: 900 } }, 1_000)).toEqual([{ at: 900 }]);
  });

  it('treats a deadline landing exactly now as due', () => {
    expect(dueDeadlines({ recv: { at: 1_000 } }, 1_000)).toEqual([{ at: 1_000 }]);
  });

  it('ignores a direction that has nothing armed', () => {
    expect(dueDeadlines<'recv' | 'send', { at: number }>({ recv: { at: 0 } }, 1)).toHaveLength(1);
  });
});

describe('stalledSteps', () => {
  it('counts nothing while a step is still within its bound', () => {
    expect(stalledSteps({ recv: 1_000 }, 5_000, 12_000)).toBe(0);
  });

  it('counts a step whose answer is overdue', () => {
    expect(stalledSteps({ recv: 1_000 }, 13_000, 12_000)).toBe(1);
  });

  it('counts nothing when no step is in flight', () => {
    expect(stalledSteps({}, 99_000, 12_000)).toBe(0);
  });
});
