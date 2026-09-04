import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The two audio animations are decoration around a state, so a listener who asks for less
 * motion still needs the state. Callers hold a resting frame on this rather than unmounting
 * what they were animating.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (current) {
        setReduced(value);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
