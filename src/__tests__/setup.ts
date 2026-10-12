import '@testing-library/jest-dom/vitest';

// Polyfills for requestAnimationFrame and cancelAnimationFrame in test / node environments
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16) as unknown as number;
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// Runtime compatibility & defensive polyfill for Vitest / JSDOM environment
// Ensures webidl.util.markAsUncloneable is available even across Node/JSDOM runtime edge cases
if (typeof (globalThis as any).webidl !== 'undefined') {
  if (!(globalThis as any).webidl) {
    (globalThis as any).webidl = {};
  }
  if (!(globalThis as any).webidl.util) {
    (globalThis as any).webidl.util = {};
  }
  if (typeof (globalThis as any).webidl.util.markAsUncloneable !== 'function') {
    (globalThis as any).webidl.util.markAsUncloneable = <T>(obj: T): T => obj;
  }
}
