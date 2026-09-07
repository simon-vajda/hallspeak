import type { ReportCategory } from '@/lib/reports';

export type { ReportRowState, SelfCheck } from '@/lib/report-state';
export { LOW_VOLUME, REPORT_DISABLE_MS, reportRows, selfCheck } from '@/lib/report-state';

/**
 * The positive signal is its own affordance, never a sixth category. It says this listener's
 * problem is gone and claims nothing about anybody else's, which is why it is not counted
 * alongside the five.
 */
export const RESOLUTION_LABEL = 'Audio sounds good now';

export const REPORT_SHEET_TITLE = 'Report a problem';
export const CHECK_FIRST_TITLE = 'Check first';
export const YOUR_VOLUME_LABEL = 'Your volume';
export const INTERPRETER_LABEL = 'The interpreter';
export const WHAT_IS_WRONG_TITLE = 'What is wrong';
export const REPORT_FOOTER =
  'Nothing identifies you, and the interpreter sees a count rather than a message.';
export const REPORT_UNAVAILABLE_NOTE = 'Reports are not sent to the interpreter in this version.';

/** The three states a send can be in, so the sheet's own transitions are exercisable. */
export type SendState =
  | { kind: 'idle' }
  | { kind: 'sending'; category: ReportCategory }
  | { kind: 'sent'; category: ReportCategory; at: number };

export const IDLE_SEND: SendState = { kind: 'idle' };

export function pendingCategory(state: SendState): ReportCategory | null {
  return state.kind === 'sending' ? state.category : null;
}

export const ALL_REPORT_SHEET_COPY: string[] = [
  RESOLUTION_LABEL,
  REPORT_SHEET_TITLE,
  CHECK_FIRST_TITLE,
  YOUR_VOLUME_LABEL,
  INTERPRETER_LABEL,
  WHAT_IS_WRONG_TITLE,
  REPORT_FOOTER,
  REPORT_UNAVAILABLE_NOTE,
];
