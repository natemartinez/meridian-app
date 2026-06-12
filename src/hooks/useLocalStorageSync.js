import { useEffect } from 'react';

/**
 * A hook that persists state to localStorage whenever it changes.
 * Takes a config object mapping state values to localStorage keys.
 * Only writes when `loaded` is true (to avoid overwriting on initial mount).
 */
export default function useLocalStorageSync(entries, loaded = true) {
  useEffect(() => {
    if (!loaded) return;
    entries.forEach(([value, key]) => {
      try {
        if (value === null || value === undefined) return;
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, str);
      } catch { /* localStorage write failure is non-critical */ }
    });
  }, [loaded, ...entries.map(([v]) => v)]);
}
