import { describe, expect, it } from '@jest/globals';
import {
  type AddVenueState,
  addVenueReducer,
  addVenueView,
  CAMERA_DENIED_NOTICE,
  INITIAL_ADD_VENUE_STATE,
  linkRefusalMessage,
  NOT_FOUND_MESSAGE,
  UNREACHABLE_MESSAGE,
} from '../src/venues/add-venue-state';

const LINK = 'https://stpauls.linguacast.app/events/481209';
const VENUE = { host: 'stpauls.linguacast.app', pin: '481209' };

function reduce(state: AddVenueState, ...inputs: string[]): AddVenueState {
  return inputs.reduce(
    (current, input) => addVenueReducer(current, { kind: 'submit', input }),
    state,
  );
}

const GRANTED = addVenueReducer(INITIAL_ADD_VENUE_STATE, {
  kind: 'permission',
  permission: 'granted',
});

describe('camera permission', () => {
  it('explains a denied camera and keeps the link path open', () => {
    const state = addVenueReducer(INITIAL_ADD_VENUE_STATE, {
      kind: 'permission',
      permission: 'denied',
    });
    const view = addVenueView(state);

    expect(view.camera).toBe('blocked');
    expect(view.cameraNotice).toBe(CAMERA_DENIED_NOTICE);
    expect(view.linkEntryEnabled).toBe(true);
  });

  it('treats an undetermined camera as pending rather than failed', () => {
    const view = addVenueView(INITIAL_ADD_VENUE_STATE);

    expect(view.camera).toBe('pending');
    expect(view.cameraNotice).toBeNull();
    expect(view.error).toBeNull();
  });

  it('shows the camera field once permission is granted', () => {
    expect(addVenueView(GRANTED).camera).toBe('active');
  });
});

describe('submitting a link', () => {
  it('reports a parse refusal without attempting a lookup', () => {
    const state = reduce(GRANTED, 'not-a-link');

    expect(state.pending).toBeNull();
    expect(state.error).toBe(linkRefusalMessage('not_a_link'));
  });

  it('refuses a link that is not https', () => {
    expect(reduce(GRANTED, 'http://stpauls.linguacast.app/events/481209').error).toBe(
      linkRefusalMessage('insecure_scheme'),
    );
  });

  it('starts one lookup for a usable link', () => {
    expect(reduce(GRANTED, LINK).pending).toEqual(VENUE);
  });

  it('ignores a submission made while one is already in flight', () => {
    const first = reduce(GRANTED, LINK);
    const second = addVenueReducer(first, {
      kind: 'submit',
      input: 'https://other.example/events/998877',
    });

    expect(second).toBe(first);
    expect(second.pending).toEqual(VENUE);
  });

  it('collapses two identical scans arriving back to back into one lookup', () => {
    const first = reduce(GRANTED, LINK);
    const second = addVenueReducer(first, { kind: 'submit', input: LINK });

    expect(second).toBe(first);
  });

  it('ignores a submission once an event has been opened', () => {
    const opened = addVenueReducer(reduce(GRANTED, LINK), {
      kind: 'resolved',
      lookup: {
        outcome: 'verified',
        event: { pin: VENUE.pin, name: 'Sunday', description: null, channels: [] },
      },
    });

    expect(addVenueReducer(opened, { kind: 'submit', input: LINK })).toBe(opened);
  });
});

describe('lookup outcomes', () => {
  it('hands the verified venue over to the event screen and clears the last error', () => {
    const failed = addVenueReducer(reduce(GRANTED, LINK), {
      kind: 'resolved',
      lookup: { outcome: 'not_found' },
    });
    const state = addVenueReducer(reduce(failed, LINK), {
      kind: 'resolved',
      lookup: {
        outcome: 'verified',
        event: { pin: VENUE.pin, name: 'Sunday', description: null, channels: [] },
      },
    });

    expect(state.opened).toEqual(VENUE);
    expect(state.error).toBeNull();
    expect(state.pending).toBeNull();
    expect(addVenueView(state).openEvent).toEqual(VENUE);
  });

  it('separates a refused code from a venue it could not reach', () => {
    const notFound = addVenueReducer(reduce(GRANTED, LINK), {
      kind: 'resolved',
      lookup: { outcome: 'not_found' },
    });
    const unreachable = addVenueReducer(reduce(GRANTED, LINK), {
      kind: 'resolved',
      lookup: { outcome: 'unreachable' },
    });

    expect(notFound.error).toBe(NOT_FOUND_MESSAGE);
    expect(unreachable.error).toBe(UNREACHABLE_MESSAGE);
    expect(notFound.error).not.toBe(unreachable.error);
  });

  it('names no cause when a venue could not be reached', () => {
    expect(UNREACHABLE_MESSAGE).not.toMatch(
      /certificate|https|tls|ssl|offline|wi-?fi|network|server|dns/i,
    );
  });

  it('releases the lookup so the next scan is accepted', () => {
    const failed = addVenueReducer(reduce(GRANTED, LINK), {
      kind: 'resolved',
      lookup: { outcome: 'unreachable' },
    });

    expect(failed.pending).toBeNull();
    expect(addVenueView(failed).busy).toBe(false);
    expect(reduce(failed, LINK).pending).toEqual(VENUE);
  });

  it('ignores an outcome that belongs to no lookup', () => {
    expect(addVenueReducer(GRANTED, { kind: 'resolved', lookup: { outcome: 'not_found' } })).toBe(
      GRANTED,
    );
  });
});

describe('link entry surface', () => {
  it('opens and closes without disturbing the camera', () => {
    const open = addVenueReducer(GRANTED, { kind: 'open-link-entry' });
    const closed = addVenueReducer(open, { kind: 'close-link-entry' });

    expect(addVenueView(open).linkEntryOpen).toBe(true);
    expect(addVenueView(closed).linkEntryOpen).toBe(false);
    expect(addVenueView(closed).camera).toBe('active');
  });

  it('drops a stale error when the surface is opened again', () => {
    const failed = reduce(GRANTED, '');
    const reopened = addVenueReducer(failed, { kind: 'open-link-entry' });

    expect(failed.error).toBe(linkRefusalMessage('empty'));
    expect(reopened.error).toBeNull();
  });
});
