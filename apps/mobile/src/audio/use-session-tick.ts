import { useEffect, useRef } from 'react';
import HallspeakAudio from '../../modules/hallspeak-audio';

/**
 * Subscribes to the listening session's native heartbeat.
 *
 * The callback is held in a ref rather than in the effect's dependencies: every consumer
 * closes over state that changes on each tick, and re-subscribing for that would drop and
 * re-add a native listener twice a second.
 */
export function useSessionTick(onTick: () => void): void {
  const handler = useRef(onTick);
  handler.current = onTick;

  useEffect(() => {
    const subscription = HallspeakAudio.addListener('onTick', () => handler.current());
    return () => subscription.remove();
  }, []);
}

/** Subscribes to the device moving to a different network. */
export function useNetworkChange(onChange: () => void): void {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    const subscription = HallspeakAudio.addListener('onNetworkChange', () => handler.current());
    return () => subscription.remove();
  }, []);
}
