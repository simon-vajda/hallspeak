import { useCallback, useEffect, useState } from 'react';
import { type MicDevice, resolveSelection, shapeDevices } from './devices';

/**
 * The microphone is real; the transport is not. `enumerateDevices`, `getUserMedia` and
 * `AnalyserNode` are plain browser APIs with no relationship to mediasoup — the stream this
 * hook produces is held by the studio, read by the meter, and goes nowhere else. When
 * mediasoup lands, the producer takes the very `MediaStreamTrack` this hook already owns;
 * nothing here has to change shape for that.
 *
 * Web-only, and deliberately not a `packages/client-core` candidate: React Native reaches
 * both of these APIs through entirely different modules.
 */

export type MicStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported';

/** Stream plus the audio graph opened for it — released as one unit, never separately. */
type Capture = {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
};

const UNSUPPORTED_MESSAGE =
  'This browser will not open a microphone on an insecure connection. Reach this page over HTTPS, or on localhost.';

function isSupported() {
  return typeof navigator !== 'undefined' && navigator.mediaDevices !== undefined;
}

/**
 * Opens the mic, wires it to an analyser, and releases both. Every exit from a capture goes
 * through here — a stream whose tracks are not stopped leaves the browser's recording
 * indicator lit, and a leaked `AudioContext` is entirely silent until someone notices the
 * battery.
 */
function release(capture: Capture) {
  for (const track of capture.stream.getTracks()) track.stop();
  void capture.context.close();
}

async function openCapture(deviceId: string | null): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: deviceId === null ? true : { deviceId: { exact: deviceId } },
  });

  const context = new AudioContext();
  // an AudioContext created outside a user gesture starts suspended, and a suspended
  // graph reports a flat line rather than an error
  void context.resume();

  const analyser = context.createAnalyser();
  context.createMediaStreamSource(stream).connect(analyser);
  // deliberately not connected to context.destination: that would play the mic back into
  // the speaker the interpreter is sitting next to

  return { stream, context, analyser };
}

function failureMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError')
    return 'Microphone access was blocked. Allow it in your browser’s site settings, then reload.';
  if (name === 'NotFoundError') return 'No microphone was found on this device.';
  if (name === 'NotReadableError')
    return 'The microphone is in use by another app. Close it and try again.';
  return 'The microphone could not be opened.';
}

/**
 * Real device enumeration, permission handling and one analyser per open stream.
 *
 * Labels come back empty until permission has been granted at least once, so the order is
 * fixed: open a stream first, *then* enumerate. That is why this requests on mount rather
 * than behind a button.
 */
export function useMicCapture() {
  const [status, setStatus] = useState<MicStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  // kept apart from `error` so re-opening on the default device — which clears `error` —
  // does not swallow the reason the device changed underneath the user
  const [notice, setNotice] = useState<string | null>(null);
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  // null means "whatever the system default is"; separate from `deviceId` so resolving the
  // opened device back into state cannot re-trigger the open
  const [requested, setRequested] = useState<string | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);

  useEffect(() => {
    if (!isSupported()) {
      setStatus('unsupported');
      setError(UNSUPPORTED_MESSAGE);
      return;
    }

    let current: Capture | null = null;
    let cancelled = false;
    setStatus('requesting');
    setError(null);

    void (async () => {
      try {
        const opened = await openCapture(requested);
        // the effect was cleaned up while getUserMedia was still resolving: the capture
        // exists but nothing will ever hold it
        if (cancelled) {
          release(opened);
          return;
        }
        current = opened;
        setCapture(opened);
        setStatus('ready');

        const shaped = shapeDevices(await navigator.mediaDevices.enumerateDevices());
        if (cancelled) return;
        setDevices(shaped);
        setDeviceId(
          resolveSelection(
            shaped,
            opened.stream.getAudioTracks()[0]?.getSettings().deviceId ?? requested,
          ),
        );
      } catch (err) {
        if (cancelled) return;
        // the exact device vanished between the picker and the open — retry on the default
        if (requested !== null && err instanceof DOMException && err.name !== 'NotAllowedError') {
          setNotice('That microphone is no longer available. Switched to the system default.');
          setRequested(null);
          return;
        }
        // 'denied' covers every terminal failure, not only a refused prompt: the screen
        // renders the same "no mic, here is why" state for all of them
        setStatus('denied');
        setError(failureMessage(err));
      }
    })();

    return () => {
      cancelled = true;
      if (current) release(current);
      setCapture(null);
    };
  }, [requested]);

  useEffect(() => {
    if (!isSupported()) return;

    const onDeviceChange = async () => {
      const shaped = shapeDevices(await navigator.mediaDevices.enumerateDevices());
      setDevices(shaped);
      setDeviceId((prev) => resolveSelection(shaped, prev));

      if (requested !== null && !shaped.some((d) => d.deviceId === requested)) {
        setNotice('That microphone was disconnected. Switched to the system default.');
        setRequested(null);
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }, [requested]);

  const selectDevice = useCallback((next: string) => {
    setNotice(null);
    // set optimistically as well as requested, so the picker does not snap back to the old
    // device for the length of the re-open
    setDeviceId(next);
    setRequested(next);
  }, []);

  return {
    status,
    error: error ?? notice,
    devices,
    deviceId,
    selectDevice,
    analyser: capture?.analyser ?? null,
    stream: capture?.stream ?? null,
  };
}
