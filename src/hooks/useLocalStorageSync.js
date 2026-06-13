import { useEffect, useRef } from 'react';

/**
 * A hook that persists state to localStorage whenever it changes.
 * Takes a config object mapping state values to localStorage keys.
 * Only writes when `loaded` is true (to avoid overwriting on initial mount).
 */
export default function useLocalStorageSync(entries, loaded = true) {
  const writeCount = useRef(0);
  useEffect(() => {
    if (!loaded) return;
    writeCount.current++;
    entries.forEach(([value, key]) => {
      try {
        if (value === null || value === undefined) return;
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, str);
      } catch { /* localStorage write failure is non-critical */ }
    });
    // Use JSON.stringify of all values as a stable dependency key.
    // This avoids creating a new array reference on every render via .map(),
    // which was causing the effect to fire on every render cycle.
  }, [loaded, JSON.stringify(entries.map(([v]) => v))]);
}
