import type { SentMap } from '@/lib/report-state';
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
export const UPDATE_REPORT_TITLE = 'Update report';
export const CHECK_FIRST_TITLE = 'Check first';
export const YOUR_VOLUME_LABEL = 'Your volume';
export const INTERPRETER_LABEL = 'The interpreter';
export const WHAT_IS_WRONG_TITLE = 'What is wrong';
/**
 * The positive signal sits *above* the categories once this connection has an open report,
 * under its own question: a listener who came back to the sheet came back to say whether it
 * is fixed, and making them scroll past five ways to complain to answer that is backwards.
 */
export const IS_IT_FIXED_TITLE = 'Is it fixed?';
export const STILL_A_PROBLEM_TITLE = 'Still having a problem?';

export const SENT_CONFIRMATION_BODY =
  'Reports are anonymous and counted together with other listeners\u2019. They clear after five minutes, and nothing comes back to you.';
export const RESOLVED_CONFIRMATION_BODY =
  'The interpreter sees your confirmation without learning who sent it.';
export const DONE_LABEL = 'Done';

/** A connection with a problem it has reported and not yet said is fixed. */
export function hasOpenReport(state: SendState, sent: SentMap): boolean {
  return state.kind !== 'resolved' && Object.keys(sent).length > 0;
}

export function reportSheetTitle(open: boolean): string {
  return open ? UPDATE_REPORT_TITLE : REPORT_SHEET_TITLE;
}
export const REPORT_FOOTER =
  'Nothing identifies you, and the interpreter sees a count rather than a message.';
export const REPORT_UNAVAILABLE_NOTE = 'Reports are not sent to the interpreter in this version.';

/** The states a send can be in, so the sheet's own transitions are exercisable. */
export type SendState =
  | { kind: 'idle' }
  | { kind: 'sending'; category: ReportCategory }
  | { kind: 'sent'; category: ReportCategory; at: number }
  | { kind: 'resolving' }
  | { kind: 'resolved' };

export const IDLE_SEND: SendState = { kind: 'idle' };

export function pendingCategory(state: SendState): ReportCategory | null {
  return state.kind === 'sending' ? state.category : null;
}

export const isBusy = (state: SendState): boolean =>
  state.kind === 'sending' || state.kind === 'resolving';

export const ALL_REPORT_SHEET_COPY: string[] = [
  RESOLUTION_LABEL,
  REPORT_SHEET_TITLE,
  UPDATE_REPORT_TITLE,
  CHECK_FIRST_TITLE,
  YOUR_VOLUME_LABEL,
  INTERPRETER_LABEL,
  WHAT_IS_WRONG_TITLE,
  IS_IT_FIXED_TITLE,
  STILL_A_PROBLEM_TITLE,
  SENT_CONFIRMATION_BODY,
  RESOLVED_CONFIRMATION_BODY,
  DONE_LABEL,
  REPORT_FOOTER,
  REPORT_UNAVAILABLE_NOTE,
];
