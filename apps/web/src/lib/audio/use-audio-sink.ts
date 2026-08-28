import { type RefObject, useEffect, useRef } from 'react';

type SinkAudioElement = HTMLAudioElement & {
  setSinkId(deviceId: string): Promise<void>;
};

function unavailable(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'NotFoundError')
  );
}

/**
 * Applies an explicit output once media can play. The persistent `canplay` listener reasserts
 * it after `srcObject` changes, which avoids Chromium falling back during a channel switch.
 */
export function useAudioSink(
  audio: RefObject<HTMLAudioElement | null>,
  deviceId: string | null,
  onUnavailable: () => void,
) {
  const lastDeviceId = useRef(deviceId);

  useEffect(() => {
    const element = audio.current as SinkAudioElement | null;
    const previousDeviceId = lastDeviceId.current;
    lastDeviceId.current = deviceId;
    if (!element) {
      return;
    }
    if (deviceId === null) {
      if (previousDeviceId !== null) {
        void element.setSinkId('').catch(() => {});
      }
      return;
    }

    let cancelled = false;
    let latest = 0;

    const apply = async () => {
      const token = ++latest;
      try {
        await element.setSinkId(deviceId);
      } catch (cause) {
        if (cancelled || token !== latest || !unavailable(cause)) {
          return;
        }

        // Empty id restores browser/system routing. Clear persistence even if fallback rejects:
        // repeating a forbidden explicit id on every reload cannot recover it.
        await element.setSinkId('').catch(() => {});
        if (!cancelled && token === latest) {
          lastDeviceId.current = null;
          onUnavailable();
        }
      }
    };

    const onCanPlay = () => void apply();
    element.addEventListener('canplay', onCanPlay);
    if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      void apply();
    }

    return () => {
      cancelled = true;
      element.removeEventListener('canplay', onCanPlay);
    };
  }, [audio, deviceId, onUnavailable]);
}
