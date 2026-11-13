import React, { lazy, ComponentType, createElement } from 'react';

/**
 * Resilient wrapper around React.lazy() that:
 * 1. Automatically retries failed dynamic `import()` calls with exponential backoff
 *    (preventing transient network hiccups or Vite dev-server transform delays from crashing routes/games).
 * 2. Resets the underlying React.lazy instance if all retries fail, so clicking "Restart"
 *    inside an ErrorBoundary performs a fresh import instead of re-throwing a cached rejection.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  intervalMs = 250
): React.LazyExoticComponent<T> {
  function attemptImport(remaining: number, delay: number): Promise<{ default: T }> {
    return factory().catch((error: unknown) => {
      if (remaining <= 0) {
        throw error;
      }
      return new Promise<{ default: T }>((resolve) => {
        setTimeout(resolve, delay);
      }).then(() => attemptImport(remaining - 1, delay * 2));
    });
  }

  function createLazyInstance(): React.LazyExoticComponent<T> {
    return lazy(() =>
      attemptImport(retries, intervalMs).catch((error: unknown) => {
        currentLazy = createLazyInstance();
        throw error;
      })
    );
  }

  let currentLazy = createLazyInstance();

  const LazyRetryWrapper = ((props: React.ComponentProps<T>) =>
    createElement(currentLazy, props)) as unknown as React.LazyExoticComponent<T>;

  return LazyRetryWrapper;
}
