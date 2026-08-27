import type { components } from '@linguacast/contract/openapi';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeakerDisplaced } from '@/components/speaker/speaker-displaced';
import { SpeakerOnAir } from '@/components/speaker/speaker-on-air';
import { SpeakerPreflight } from '@/components/speaker/speaker-preflight';
import { levelStatus, meterLevel, rms } from '@/lib/audio/level';
import { useAudioPreferences } from '@/lib/audio/use-audio-preferences';
import { useMicCapture } from '@/lib/audio/use-mic-capture';
import { type ChannelStatusEntry, rollbackMutedAfterFailure } from '@/lib/channel-status';
import { connectionState } from '@/lib/media/stats';
import { isSuperseded, useMedia } from '@/lib/media/use-media';
import type { SocketStatus } from '@/lib/use-socket';
import type { SocketClient } from '@/socket/client';
import { type BroadcastEnd, broadcastState, onReconnect } from './speaker-studio-state';

type PublicChannel = components['schemas']['PublicChannel'];

// The go-live gate is a one-way latch, not a meter, so it polls rather than reading per frame.
const SIGNAL_POLL_MS = 200;

/**
 * On air means a producer exists, never that the button was pressed: the badge must not
 * claim anyone is hearing this microphone before the server has the audio.
 */
export function SpeakerStudio({
  eventName,
  pin,
  channel,
  speakerCode,
  listeners,
  socket,
  status,
  socketError,
  channelStatus,
}: {
  eventName: string;
  pin: string;
  channel: PublicChannel;
  speakerCode: string;
  /** Guests currently receiving this channel's audio. */
  listeners: number;
  socket: SocketClient | null;
  status: SocketStatus;
  socketError: string | null;
  /** Current Socket.IO snapshot; REST deliberately carries liveness only. */
  channelStatus: ChannelStatusEntry | undefined;
}) {
  const [goLivePressed, setGoLivePressed] = useState(false);
  // Used before the first server snapshot and while recovering from a rejected control.
  const [localMuted, setLocalMuted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [displaced, setDisplaced] = useState(false);
  const [lastEnd, setLastEnd] = useState<BroadcastEnd | null>(null);
  // Latest state applied to the local producer. Unlike the server snapshot, this updates
  // synchronously when the interpreter clicks, so a drop cannot record the previous state.
  const effectiveMutedRef = useRef(false);

  const setEffectiveMuted = useCallback((muted: boolean) => {
    effectiveMutedRef.current = muted;
    setLocalMuted(muted);
  }, []);

  const { preferences, setPreferences } = useAudioPreferences();
  const mic = useMicCapture(preferences);
  const media = useMedia(socket);
  const channelStatusRef = useRef(channelStatus);
  channelStatusRef.current = channelStatus;

  const hasProducer = media.state.producerId !== null;
  const isMuted =
    channelStatus?.online && channelStatus.muted !== null ? channelStatus.muted : localMuted;
  const state = broadcastState({
    goLivePressed,
    hasProducer,
    isMuted,
    displaced,
  });

  const outputTrack = mic.outputTrack;
  // Destructured, not the whole hook result: `media` is a fresh object every render, so
  // closing over it would churn this callback's identity and re-fire the effect below on
  // every render rather than when its guards actually change.
  const { startProducing, replaceProducerTrack } = media;
  // What the producer is currently transmitting, so a capture rebuild is detectable.
  const producedTrack = useRef<MediaStreamTrack | null>(null);

  const produce = useCallback(
    async (paused: boolean) => {
      if (!outputTrack) {
        return;
      }
      try {
        await startProducing(channel.slug, outputTrack, paused);
        producedTrack.current = outputTrack;
      } catch (cause) {
        // A reset landed mid-negotiation; its own renegotiation takes over from here.
        if (!isSuperseded(cause)) {
          console.error('media: could not go live', cause);
        }
      }
    },
    [startProducing, outputTrack, channel.slug],
  );

  /**
   * Anything that re-opens the microphone rebuilds the capture graph and closes the
   * AudioContext the previous track belonged to. Left alone, the producer keeps that dead
   * track and the channel stays live while transmitting silence — so the new track is
   * swapped in. Covers a deliberate device change, an unplugged microphone falling back to
   * the default, and a noise-suppression, auto-gain or echo-cancellation toggle, which the
   * browser will only honour on a fresh `getUserMedia`.
   */
  useEffect(() => {
    if (!hasProducer || !outputTrack) {
      return;
    }
    if (producedTrack.current === outputTrack) {
      return;
    }

    producedTrack.current = outputTrack;
    void replaceProducerTrack(outputTrack).catch((cause) => {
      console.error('media: could not switch microphone', cause);
    });
  }, [hasProducer, outputTrack, replaceProducerTrack]);

  /**
   * The server ends a session by disconnecting it, and Socket.IO does not reconnect after
   * one. Reaching this means the channel is no longer ours — another device took the
   * speaker link, or the code behind it was regenerated.
   */
  useEffect(() => {
    if (!socket) {
      return;
    }
    const onDisconnect = (reason: string) => {
      if (reason === 'io server disconnect') {
        setDisplaced(true);
      }
    };
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  // Records the effective mute state before reset, so reconnect restores the same state.
  const wasConnected = useRef(false);
  useEffect(() => {
    if (status === 'connected') {
      wasConnected.current = true;
      return;
    }
    if (status === 'lost' && wasConnected.current && goLivePressed && lastEnd === null) {
      setLastEnd({ reason: 'dropped', muted: effectiveMutedRef.current });
    }
  }, [status, goLivePressed, lastEnd]);

  /**
   * After an involuntary drop the client rebuilds and re-produces in the same mute state.
   * After a deliberate end it does nothing — a broadcast somebody chose to stop must not
   * restart itself because the Wi-Fi blinked.
   */
  useEffect(() => {
    if (status !== 'connected' || hasProducer || !outputTrack) {
      return;
    }
    const action = onReconnect({ goLivePressed, lastEnd, displaced });
    if (action.type !== 're-produce') {
      return;
    }

    let cancelled = false;
    void produce(action.paused).then(() => {
      if (cancelled) {
        return;
      }
      setEffectiveMuted(action.paused);
      setLastEnd(null);
    });
    return () => {
      cancelled = true;
    };
  }, [
    status,
    hasProducer,
    outputTrack,
    goLivePressed,
    lastEnd,
    displaced,
    produce,
    setEffectiveMuted,
  ]);
  // Never cleared: the button must not flicker back to disabled during a pause between words.
  const [heardSomething, setHeardSomething] = useState(false);

  useEffect(() => {
    const analyser = mic.analyser;
    if (!analyser || heardSomething) {
      return;
    }

    const frame = new Float32Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(frame);
      if (levelStatus(meterLevel(rms(frame))) !== 'quiet') {
        setHeardSomething(true);
      }
    }, SIGNAL_POLL_MS);

    return () => clearInterval(timer);
  }, [mic.analyser, heardSomething]);

  // A suspended AudioContext reports a flat line, so `heardSomething` never latches and Go
  // live stays disabled. Go live is the one control that cannot be the resuming gesture.
  const { suspended, resume } = mic;
  useEffect(() => {
    if (!suspended) {
      return;
    }

    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
  }, [suspended, resume]);

  if (state === 'displaced') {
    return <SpeakerDisplaced channelName={channel.name} eventName={eventName} />;
  }

  if (goLivePressed) {
    return (
      <SpeakerOnAir
        channel={channel}
        eventName={eventName}
        pin={pin}
        mic={mic}
        startedAt={startedAt}
        listeners={listeners}
        state={state}
        connection={connectionState({
          socketConnected: status === 'connected',
          mediaTrouble: media.health === 'trouble',
          live: hasProducer,
          paused: state === 'muted',
          stats: media.stats,
        })}
        onToggleMute={() => {
          const next = !isMuted;
          const requestRevision = channelStatus?.revision ?? 0;
          const producerControl = {
            generation: media.state.generation,
            producerId: media.state.producerId,
          };
          setEffectiveMuted(next);
          void media.setProducerPaused(next).catch((cause) => {
            const rollbackMuted = rollbackMutedAfterFailure({
              requestedMuted: next,
              requestRevision,
              current: channelStatusRef.current,
            });
            if (!media.setLocalProducerPaused(rollbackMuted, producerControl)) {
              return;
            }
            setEffectiveMuted(rollbackMuted);
            console.error('media: could not change mute', cause);
          });
        }}
        onEnd={() => {
          // Recorded before the close, so the reconnect effect cannot read it as a drop.
          setLastEnd({ reason: 'deliberate' });
          setGoLivePressed(false);
          setEffectiveMuted(false);
          setStartedAt(null);
          void media.stopProducing();
        }}
        preferences={preferences}
        onPreferencesChange={setPreferences}
        status={status}
        socketError={socketError}
      />
    );
  }

  const canGoLive = mic.deviceId !== null && heardSomething && mic.outputTrack !== null;

  return (
    <SpeakerPreflight
      eventName={eventName}
      pin={pin}
      channel={channel}
      speakerCode={speakerCode}
      mic={mic}
      preferences={preferences}
      onPreferencesChange={setPreferences}
      canGoLive={canGoLive}
      onGoLive={() => {
        setEffectiveMuted(false);
        setGoLivePressed(true);
        setLastEnd(null);
        setStartedAt(Date.now());
        void produce(false);
      }}
      status={status}
      socketError={socketError}
    />
  );
}
