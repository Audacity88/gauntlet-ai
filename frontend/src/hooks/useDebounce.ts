import { useCallback, useRef } from 'react';

/**
 * A hook that returns a debounced version of the provided function.
 * The debounced function will only be called after the specified delay
 * has passed without any new calls.
 * 
 * @param fn The function to debounce
 * @param delay The delay in milliseconds
 * @returns A debounced version of the function
 */
export function useDebounce<T extends (...args: any[]) => Promise<void>>(
  fn: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      return new Promise<void>((resolve, reject) => {
        timeoutRef.current = setTimeout(async () => {
          try {
            await fn(...args);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, delay);
      });
    },
    [fn, delay]
  );

  return debouncedFn as T;
} 