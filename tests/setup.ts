// tests/setup.ts
// Universal headless polyfills for Node.js execution under Vitest and CI runners

if (typeof globalThis.navigator === 'undefined') {
  (globalThis as any).navigator = {
    userAgent: 'Mozilla/5.0 (Node.js headless)',
  };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}
