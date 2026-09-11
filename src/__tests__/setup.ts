import '@testing-library/jest-dom/vitest';

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
