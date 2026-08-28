import { useCallback, useEffect, useRef, useState } from 'react';
import { type AudioDevice, shapeDevices } from './devices';
import {
  AUDIO_OUTPUT_STORAGE_KEY,
  hasNamedOutputs,
  parseStoredOutput,
  resolveOutputSelection,
  serializeOutput,
  supportsAudioOutputSelection,
} from './output';

export type AudioOutputStatus = 'unsupported' | 'locked' | 'unlocking' | 'denied' | 'ready';

type OutputMediaDevices = MediaDevices & {
  selectAudioOutput?: () => Promise<MediaDeviceInfo>;
};

function readStoredOutput(): string | null {
  try {
    return parseStoredOutput(localStorage.getItem(AUDIO_OUTPUT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredOutput(deviceId: string | null) {
  try {
    if (deviceId === null) {
      localStorage.removeItem(AUDIO_OUTPUT_STORAGE_KEY);
    } else {
      localStorage.setItem(AUDIO_OUTPUT_STORAGE_KEY, serializeOutput(deviceId));
    }
  } catch {
    // Blocked storage: routing still applies for this page lifetime.
  }
}

function unlockFailureMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') {
    return 'Access was blocked, so this browser cannot list audio outputs. Change the site permission, then try again.';
  }
  if (name === 'NotFoundError') {
    return 'No audio output was found. Connect headphones or speakers, then try again.';
  }
  return 'This browser could not list audio outputs. You can try again.';
}

/**
 * Owns output discovery, its explicit permission unlock and one browser-wide selection.
 * Opening a surface around this hook has no permission side effect; only `unlock` can prompt.
 */
export function useAudioOutput() {
  const supported = useRef(supportsAudioOutputSelection()).current;
  const [status, setStatus] = useState<AudioOutputStatus>(supported ? 'locked' : 'unsupported');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [deviceId, setDeviceIdState] = useState<string | null>(readStoredOutput);
  const deviceIdRef = useRef(deviceId);
  const mounted = useRef(true);
  const latestEnumeration = useRef(0);

  const setDeviceId = useCallback((next: string | null, persist: boolean) => {
    deviceIdRef.current = next;
    setDeviceIdState(next);
    if (persist) {
      writeStoredOutput(next);
    }
  }, []);

  const commitDevices = useCallback(
    (nextDevices: AudioDevice[], candidate = deviceIdRef.current, persistCandidate = false) => {
      if (!hasNamedOutputs(nextDevices)) {
        setDevices([]);
        setStatus('locked');
        return;
      }

      setDevices(nextDevices);
      setStatus('ready');
      const resolved = resolveOutputSelection(nextDevices, candidate);
      if (resolved !== candidate) {
        setDeviceId(null, true);
      } else {
        setDeviceId(resolved, persistCandidate);
      }
    },
    [setDeviceId],
  );

  const enumerate = useCallback(async (): Promise<AudioDevice[] | null> => {
    const token = ++latestEnumeration.current;
    const next = shapeDevices(await navigator.mediaDevices.enumerateDevices(), 'audiooutput');
    return mounted.current && token === latestEnumeration.current ? next : null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!supported) {
      return;
    }

    void enumerate()
      .then((next) => {
        if (next) {
          commitDevices(next);
        }
      })
      .catch(() => {
        if (mounted.current) {
          setStatus('locked');
        }
      });

    return () => {
      mounted.current = false;
      latestEnumeration.current += 1;
    };
  }, [supported, enumerate, commitDevices]);

  useEffect(() => {
    if (!supported || status !== 'ready') {
      return;
    }

    const onDeviceChange = () => {
      void enumerate()
        .then((next) => {
          if (next) {
            commitDevices(next);
          }
        })
        .catch(() => {});
    };

    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }, [supported, status, enumerate, commitDevices]);

  const unlock = useCallback(async () => {
    if (!supported || status === 'unlocking') {
      return;
    }

    setStatus('unlocking');
    setError(null);

    try {
      const mediaDevices = navigator.mediaDevices as OutputMediaDevices;
      let selectedByBrowser: string | null = null;

      if (typeof mediaDevices.selectAudioOutput === 'function') {
        selectedByBrowser = (await mediaDevices.selectAudioOutput()).deviceId;
      } else {
        const stream = await mediaDevices.getUserMedia({ audio: true });
        // Release before enumeration or any state update: a listener page must never retain it.
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }

      const next = await enumerate();
      if (next) {
        commitDevices(next, selectedByBrowser ?? deviceIdRef.current, selectedByBrowser !== null);
      }
    } catch (cause) {
      if (!mounted.current) {
        return;
      }
      setStatus('denied');
      setError(unlockFailureMessage(cause));
    }
  }, [supported, status, enumerate, commitDevices]);

  const select = useCallback(
    (next: string) => {
      if (devices.some((device) => device.deviceId === next)) {
        setDeviceId(next, true);
      }
    },
    [devices, setDeviceId],
  );

  const clearSelection = useCallback(() => setDeviceId(null, true), [setDeviceId]);

  return {
    status,
    error,
    devices,
    /** Null means follow the system default. */
    deviceId,
    /** First item represents the physical device behind the system-default alias. */
    currentDevice: devices.find((device) => device.deviceId === deviceId) ?? devices[0] ?? null,
    unlock,
    select,
    clearSelection,
  };
}
