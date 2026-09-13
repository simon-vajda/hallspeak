import { describe, expect, it } from '@jest/globals';
import type { LinkRefusalReason } from '../links/parse';
import {
  cameraPermission,
  INITIAL_SCAN_STATE,
  offersSettings,
  rearm,
  refusalMessage,
  scan,
  showsTorch,
} from './scanner-state';

const EVENT_URL = 'https://stpauls.linguacast.app/events/834912';
const CHANNEL_URL = 'https://stpauls.linguacast.app/events/834912/magyar';

describe('the scan latch', () => {
  it('accepts one result and ignores repeats until reset', () => {
    const first = scan(INITIAL_SCAN_STATE, EVENT_URL);

    expect(first.destination?.pin).toBe('834912');

    const repeat = scan(first.state, EVENT_URL);

    expect(repeat.destination).toBe(null);
    expect(repeat.haptic).toBe(false);
    expect(scan(rearm(), EVENT_URL).destination?.pin).toBe('834912');
  });

  it('yields the channel destination for a channel code', () => {
    expect(scan(INITIAL_SCAN_STATE, CHANNEL_URL).destination).toEqual({
      host: 'stpauls.linguacast.app',
      pin: '834912',
      slug: 'magyar',
    });
  });

  it('reports a speaker code with the channel destination, and still buzzes', () => {
    const outcome = scan(INITIAL_SCAN_STATE, `${CHANNEL_URL}?speaker_code=abc123`);

    expect(outcome.speakerCode).toBe('abc123');
    expect(outcome.destination?.slug).toBe('magyar');
    expect(outcome.haptic).toBe(true);
    expect(scan(INITIAL_SCAN_STATE, CHANNEL_URL).speakerCode).toBe(null);
  });

  it('refuses an unrelated URL inline and can be re-armed', () => {
    const refused = scan(INITIAL_SCAN_STATE, 'https://example.com/some/page');

    expect(refused.destination).toBe(null);
    expect(refused.state.refusal).toBe('wrong-path');
    expect(rearm()).toEqual(INITIAL_SCAN_STATE);
  });

  it('buzzes for an accepted code and for nothing else', () => {
    expect(scan(INITIAL_SCAN_STATE, EVENT_URL).haptic).toBe(true);
    expect(scan(INITIAL_SCAN_STATE, 'not a link').haptic).toBe(false);
  });

  it('refuses whitespace and an empty field without a request', () => {
    expect(scan(INITIAL_SCAN_STATE, '   ').state.refusal).toBe('not-a-url');
    expect(scan(INITIAL_SCAN_STATE, '').state.refusal).toBe('not-a-url');
  });
});

describe('camera permission', () => {
  it('separates never-asked from refused', () => {
    expect(cameraPermission(null)).toBe('undetermined');
    expect(cameraPermission({ granted: false, canAskAgain: true })).toBe('undetermined');
    expect(cameraPermission({ granted: false, canAskAgain: false })).toBe('denied');
    expect(cameraPermission({ granted: true, canAskAgain: false })).toBe('granted');
  });

  it('offers the settings route only once asking again is impossible', () => {
    expect(offersSettings('denied')).toBe(true);
    expect(offersSettings('undetermined')).toBe(false);
    expect(offersSettings('granted')).toBe(false);
  });

  it('withholds the torch until there is a live camera to light for', () => {
    expect(showsTorch('granted')).toBe(true);
    expect(showsTorch('undetermined')).toBe(false);
    expect(showsTorch('denied')).toBe(false);
  });
});

describe('refusalMessage', () => {
  it('names what was wrong for every reason the parser can give', () => {
    const reasons: LinkRefusalReason[] = [
      'not-a-url',
      'insecure-scheme',
      'unknown-host',
      'wrong-path',
      'bad-pin',
      'bad-slug',
    ];

    for (const reason of reasons) {
      expect(`${reason} ${refusalMessage(reason).length > 0}`).toBe(`${reason} true`);
    }
  });
});
