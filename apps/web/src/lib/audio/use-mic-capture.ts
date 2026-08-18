import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AudioPreferences,
  gainNodeValue,
  trackConstraints,
} from '@/components/speaker/live-state';
import { type MicDevice, resolveSelection, shapeDevices } from './devices';

const DEFAULT_PREFERENCES: AudioPreferences = {
  noiseSuppression: true,
  autoGain: false,
  gain: 50,
};

/**
 * Owns the capture graph and the one track a producer broadcasts. Web-only: React Native
 * reaches these APIs through entirely different modules.
 *
 * The graph is source → gain → analyser and source → gain → destination, so the meter
 * shows what is actually sent and the manual gain reaches the audio rather than only the
 * display. `outputTrack` comes off that destination, never off the raw stream.
 */

export type MicStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported';

type Capture = {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  gain: GainNode;
  /** What the producer broadcasts: the processed graph, not the raw microphone. */
  output: MediaStreamAudioDestinationNode;
};

const UNSUPPORTED_MESSAGE =
  'This browser will not open a microphone on an insecure connection. Reach this page over HTTPS, or on localhost.';

function isSupported() {
  return typeof navigator !== 'undefined' && navigator.mediaDevices !== undefined;
}

/** Every exit from a capture goes through here: unstopped tracks leave the indicator lit. */
function release(capture: Capture) {
  for (const track of capture.stream.getTracks()) track.stop();
  void capture.context.close();
}

async function openCapture(
  deviceId: string | null,
  constraints: MediaTrackConstraints,
): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio:
      deviceId === null ? { ...constraints } : { ...constraints, deviceId: { exact: deviceId } },
  });

  const context = new AudioContext();
  // Created outside a user gesture, an AudioContext starts suspended and reports a flat line
  // rather than an error. Safari refuses to resume without a gesture; hence `suspended`/`resume`.
  await context.resume().catch(() => {});

  const analyser = context.createAnalyser();
  const gain = context.createGain();
  const output = context.createMediaStreamDestination();

  context.createMediaStreamSource(stream).connect(gain);
  gain.connect(analyser);
  gain.connect(output);
  // Never connected to context.destination: that would play the mic back into the room.

  return { stream, context, analyser, gain, output };
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
 * Labels come back empty until permission has been granted at least once, so the order is
 * fixed: open a stream first, then enumerate. Hence the request on mount, not behind a button.
 */
export function useMicCapture(preferences: AudioPreferences = DEFAULT_PREFERENCES) {
  const [status, setStatus] = useState<MicStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  // Never merged into `error`: a notice sits under the still-working picker, an error replaces it.
  const [notice, setNotice] = useState<string | null>(null);
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  // null means the system default. Separate from `deviceId` so resolving the opened device
  // back into state cannot re-trigger the open.
  const [requested, setRequested] = useState<string | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [suspended, setSuspended] = useState(false);
  // Re-opening the same device leaves `requested` unchanged; bumping this re-runs the effect.
  const [attempt, setAttempt] = useState(0);

  // Read inside the open, never depended on: a preference change re-applies to the live
  // graph below rather than re-opening the device and interrupting a live broadcast.
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  // biome-ignore lint/correctness/useExhaustiveDependencies: nothing reads `attempt` on purpose — re-running this effect is the whole of what bumping it does
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
        const opened = await openCapture(requested, trackConstraints(preferencesRef.current));
        opened.gain.gain.value = gainNodeValue(preferencesRef.current.gain);
        // Cleaned up while getUserMedia was resolving: the capture exists but nothing holds it.
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
        // The device vanished between the picker and the open: retry on the default.
        if (requested !== null && err instanceof DOMException && err.name !== 'NotAllowedError') {
          setNotice('That microphone is no longer available. Switched to the system default.');
          setRequested(null);
          return;
        }
        // 'denied' covers every terminal failure, not only a refused prompt: one screen state.
        setStatus('denied');
        setError(failureMessage(err));
      }
    })();

    return () => {
      cancelled = true;
      if (current) release(current);
      setCapture(null);
    };
  }, [requested, attempt]);

  // Tracks the context rather than the read taken at open time: a gesture-driven resume and
  // an OS interruption both arrive as a statechange.
  useEffect(() => {
    const context = capture?.context;
    if (!context) {
      setSuspended(false);
      return;
    }

    const sync = () => setSuspended(context.state !== 'running');
    sync();
    context.addEventListener('statechange', sync);
    return () => context.removeEventListener('statechange', sync);
  }, [capture]);

  useEffect(() => {
    if (!isSupported()) return;

    let cancelled = false;
    // Chrome fires devicechange twice per hot-plug, so two enumerations can resolve out of order.
    let latest = 0;

    const onDeviceChange = async () => {
      const token = ++latest;
      let shaped: MicDevice[];
      try {
        shaped = shapeDevices(await navigator.mediaDevices.enumerateDevices());
      } catch {
        return;
      }
      if (cancelled || token !== latest) return;

      setDevices(shaped);
      setDeviceId((prev) => resolveSelection(shaped, prev));

      // The device actually open, not `requested`: that is null whenever the hook is on the
      // system default, so testing it would leave an unplugged default open as a dead track.
      if (deviceId !== null && !shaped.some((d) => d.deviceId === deviceId)) {
        setNotice('That microphone was disconnected. Switched to the system default.');
        setRequested(null);
        setAttempt((n) => n + 1);
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
    };
  }, [deviceId]);

  // Applied to the live graph rather than by re-opening: `applyConstraints` re-negotiates
  // the browser's processing in place, and the gain is one node's value.
  useEffect(() => {
    if (!capture) return;
    capture.gain.gain.value = gainNodeValue(preferences.gain);
    void capture.stream
      .getAudioTracks()[0]
      ?.applyConstraints(trackConstraints(preferences))
      .catch(() => {});
  }, [capture, preferences]);

  const selectDevice = useCallback((next: string) => {
    setNotice(null);
    // Set optimistically, so the picker does not snap back to the old device during the re-open.
    setDeviceId(next);
    setRequested(next);
  }, []);

  const retry = useCallback(() => {
    setNotice(null);
    setAttempt((n) => n + 1);
  }, []);

  /** Must be called from a real user gesture: Safari resumes on nothing else. */
  const resume = useCallback(() => {
    if (!capture) return;
    void capture.context.resume().catch(() => {});
  }, [capture]);

  return {
    status,
    error,
    notice,
    suspended,
    devices,
    deviceId,
    selectDevice,
    retry,
    resume,
    analyser: capture?.analyser ?? null,
    stream: capture?.stream ?? null,
    /** The processed track a producer broadcasts, which is not the raw microphone track. */
    outputTrack: capture?.output.stream.getAudioTracks()[0] ?? null,
  };
}
