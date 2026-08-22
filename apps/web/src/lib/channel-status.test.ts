import { describe, expect, it } from 'vitest';
import {
  applyJoinStatus,
  applyRealtimeStatus,
  beginChannelJoin,
  channelStatusFromHttp,
  initialChannelStatuses,
  projectOnlineStatuses,
  resetStatusOrdering,
  rollbackMutedAfterFailure,
} from './channel-status';

describe('channel status reconciliation', () => {
  it('uses HTTP only for liveness and leaves mute unknown for an online producer', () => {
    expect(channelStatusFromHttp(true)).toEqual({ online: true, muted: null });
    expect(channelStatusFromHttp(false)).toEqual({ online: false, muted: false });
  });

  it('lets a join acknowledgement correct an HTTP status that became stale', () => {
    const started = beginChannelJoin(initialChannelStatuses, 'english', true);
    const reconciled = applyJoinStatus(started.state, started.ticket, {
      online: true,
      muted: true,
    });

    expect(reconciled.channels.english).toMatchObject({ online: true, muted: true });
  });

  it('does not let a delayed join acknowledgement overwrite newer realtime status', () => {
    const started = beginChannelJoin(initialChannelStatuses, 'english', true);
    const realtime = applyRealtimeStatus(started.state, 'english', {
      online: true,
      muted: true,
    });
    const delayed = applyJoinStatus(realtime, started.ticket, {
      online: true,
      muted: false,
    });

    expect(delayed).toBe(realtime);
    expect(delayed.channels.english).toMatchObject({ online: true, muted: true });
  });

  it('clears muted whenever the authoritative producer becomes offline', () => {
    const muted = applyRealtimeStatus(initialChannelStatuses, 'english', {
      online: true,
      muted: true,
    });

    expect(
      applyRealtimeStatus(muted, 'english', { online: false, muted: true }).channels.english,
    ).toMatchObject({ online: false, muted: false });
  });

  it('projects selector liveness from the same status entries regardless of mute', () => {
    const muted = applyRealtimeStatus(initialChannelStatuses, 'english', {
      online: true,
      muted: true,
    });
    const unmuted = applyRealtimeStatus(muted, 'english', { online: true, muted: false });
    const offline = applyRealtimeStatus(unmuted, 'spanish', { online: false, muted: true });

    expect(projectOnlineStatuses(muted.channels)).toEqual({ english: true });
    expect(projectOnlineStatuses(offline.channels)).toEqual({ english: true, spanish: false });
  });

  it('makes online mute unknown again when a new connection starts', () => {
    const muted = applyRealtimeStatus(initialChannelStatuses, 'english', {
      online: true,
      muted: true,
    });
    const reset = resetStatusOrdering(muted);

    expect(reset.connectionRevision).toBeGreaterThan(muted.connectionRevision);
    expect(reset.channels.english).toMatchObject({ online: true, muted: null, revision: 0 });
  });
});

describe('failed mute control reconciliation', () => {
  it('restores local transmission when a pause is rejected without newer status', () => {
    expect(
      rollbackMutedAfterFailure({
        requestedMuted: true,
        requestRevision: 4,
        current: { online: true, muted: false, revision: 4 },
      }),
    ).toBe(false);
  });

  it('restores the safe muted state when a resume is rejected without newer status', () => {
    expect(
      rollbackMutedAfterFailure({
        requestedMuted: false,
        requestRevision: 4,
        current: { online: true, muted: true, revision: 4 },
      }),
    ).toBe(true);
  });

  it('follows a newer authoritative status instead of undoing it', () => {
    expect(
      rollbackMutedAfterFailure({
        requestedMuted: true,
        requestRevision: 4,
        current: { online: true, muted: true, revision: 5 },
      }),
    ).toBe(true);
  });
});
