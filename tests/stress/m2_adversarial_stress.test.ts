// tests/stress/m2_adversarial_stress.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EffectsManager } from '../../src/render/effects';
import { GameSimulation } from '../../src/core/simulation';
import { createPixiApp, destroyPixiApp } from '../../src/render/app';
import { Application, TextureSource, Text, Graphics, Container } from 'pixi.js';

// Polyfill requestAnimationFrame / cancelAnimationFrame for headless Node environment
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}

describe('Milestone 2 Empirical Challenger Stress Suite', () => {
  // =========================================================================
  // 1. Floating Text & Particle Effects Stress
  // =========================================================================
  describe('1. Floating Text & Particle Effects Stress', () => {
    let effects: EffectsManager;

    beforeEach(() => {
      effects = new EffectsManager();
    });

    afterEach(() => {
      effects.clear();
    });

    it('handles spam of 100 clicks in a single frame', () => {
      for (let i = 0; i < 100; i++) {
        effects.spawnFloatingText({
          text: `+${i + 1}g`,
          x: 100 + i,
          y: 200,
          isCrit: i % 10 === 0,
        });
        effects.spawnSparkles({
          x: 100 + i,
          y: 200,
          count: 6,
        });
      }

      // 100 text + 600 sparkles = 700 display objects
      expect(effects.container.children.length).toBe(700);
      expect((effects as any).activeEffects.length).toBe(700);

      // Advance by 0.5 seconds: non-crit texts should still be alive, sparkles expiring
      effects.update(0.5);
      expect(effects.container.children.length).toBeLessThan(700);

      // Advance past 2.0 seconds: all 700 effects must expire and be destroyed
      effects.update(1.5);
      expect(effects.container.children.length).toBe(0);
      expect((effects as any).activeEffects.length).toBe(0);
    });

    it('reveals lack of particle pool limit under 1,000 rapid clicks', () => {
      const clickCount = 1000;
      for (let i = 0; i < clickCount; i++) {
        effects.spawnFloatingText({
          text: 'CRIT! +15g',
          x: 200,
          y: 200,
          isCrit: true,
        });
        effects.spawnSparkles({
          x: 200,
          y: 200,
          count: 8,
        });
      }

      // 1,000 * (1 text + 8 sparkles) = 9,000 active display objects!
      const totalCreated = effects.container.children.length;
      expect(totalCreated).toBe(9000);
      expect((effects as any).activeEffects.length).toBe(9000);

      // Verify that all 9,000 are properly cleaned up and destroyed on full expiration
      effects.update(2.0); // max lifetime is ~1.2s
      expect(effects.container.children.length).toBe(0);
      expect((effects as any).activeEffects.length).toBe(0);
    });

    it('verifies display objects are genuinely destroyed to prevent memory leaks', () => {
      effects.spawnFloatingText({
        text: 'Test Cleanup',
        x: 50,
        y: 50,
      });
      effects.spawnSparkles({
        x: 50,
        y: 50,
        count: 4,
      });

      const spawnedObjects = [...effects.container.children];
      expect(spawnedObjects.length).toBe(5);

      for (const obj of spawnedObjects) {
        expect((obj as any).destroyed).toBe(false);
      }

      // Update past lifetime
      effects.update(1.5);

      // Verify each object was destroyed
      expect(effects.container.children.length).toBe(0);
      for (const obj of spawnedObjects) {
        expect((obj as any).destroyed).toBe(true);
      }
    });

    it('clear() immediately purges and destroys all active effects', () => {
      for (let i = 0; i < 50; i++) {
        effects.spawnFloatingText({ text: `+${i}g`, x: i, y: i });
        effects.spawnSparkles({ x: i, y: i, count: 5 });
      }

      expect(effects.container.children.length).toBe(300);

      effects.clear();

      expect(effects.container.children.length).toBe(0);
      expect((effects as any).activeEffects.length).toBe(0);
    });

    it('resists adversarial deltaSeconds (0, negative, huge)', () => {
      effects.spawnFloatingText({ text: 'Adversarial Delta', x: 0, y: 0 });
      expect(effects.container.children.length).toBe(1);

      // 0 delta: should not throw, lifetime unchanged
      effects.update(0);
      expect(effects.container.children.length).toBe(1);

      // Negative delta: should not crash
      effects.update(-0.5);
      expect(effects.container.children.length).toBe(1);

      // Huge delta: instant expiration
      effects.update(10000);
      expect(effects.container.children.length).toBe(0);
    });
  });

  // =========================================================================
  // 2. PixiJS Application Lifecycle & Memory Management
  // =========================================================================
  describe('2. PixiJS Application Lifecycle & Memory Management', () => {
    let mockContainer: any;
    let mockCanvas: any;
    let mockCtx: any;
    let originalGlobal: any;

    beforeEach(() => {
      originalGlobal = {
        window: (globalThis as any).window,
        document: (globalThis as any).document,
        addEventListener: (globalThis as any).addEventListener,
        removeEventListener: (globalThis as any).removeEventListener,
        devicePixelRatio: (globalThis as any).devicePixelRatio,
      };

      mockCtx = {
        imageSmoothingEnabled: false,
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        resetTransform: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
      };

      mockCanvas = {
        getContext: vi.fn((type: string) => (type === '2d' ? mockCtx : null)),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        style: {},
        setAttribute: vi.fn(),
        getAttribute: vi.fn(() => null),
        getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 960, height: 640 })),
        width: 960,
        height: 640,
        remove: vi.fn(),
        parentNode: null as any,
      };
      mockCtx.canvas = mockCanvas;

      mockContainer = {
        appendChild: vi.fn((child: any) => {
          child.parentNode = mockContainer;
        }),
        removeChild: vi.fn((child: any) => {
          if (child.parentNode === mockContainer) {
            child.parentNode = null;
          }
        }),
      };

      (globalThis as any).addEventListener = vi.fn();
      (globalThis as any).removeEventListener = vi.fn();
      (globalThis as any).window = globalThis;
      (globalThis as any).devicePixelRatio = 1;
      (globalThis as any).document = {
        createElement: vi.fn((tag: string) => {
          if (tag === 'canvas') return mockCanvas;
          return {
            style: {},
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            remove: vi.fn(),
          };
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    });

    afterEach(() => {
      (globalThis as any).window = originalGlobal.window;
      (globalThis as any).document = originalGlobal.document;
      (globalThis as any).addEventListener = originalGlobal.addEventListener;
      (globalThis as any).removeEventListener = originalGlobal.removeEventListener;
      (globalThis as any).devicePixelRatio = originalGlobal.devicePixelRatio;
    });

    it('initializes PixiJS v8 Application with crisp nearest-neighbor configuration', async () => {
      const app = new Application();
      await app.init({
        width: 960,
        height: 640,
        preference: 'canvas',
        antialias: false,
        roundPixels: true,
        autoStart: false,
      });

      expect(app.renderer).toBeDefined();
      expect(app.screen.width).toBe(960);
      expect(app.screen.height).toBe(640);
      expect(TextureSource.defaultOptions.scaleMode).toBe('nearest');

      const stage = app.stage;
      destroyPixiApp(app);
      expect((stage as any).destroyed).toBe(true);
      expect(app.stage).toBeNull();
    });

    it('destroyPixiApp cleanly releases renderer, textures, and global pools', async () => {
      const app = new Application();
      await app.init({
        width: 960,
        height: 640,
        preference: 'canvas',
        autoStart: false,
      });

      // Add child container and display objects
      const testLayer = new Container();
      const g = new Graphics();
      g.rect(0, 0, 10, 10);
      testLayer.addChild(g);
      app.stage.addChild(testLayer);

      expect(app.stage.children.length).toBe(1);

      const stage = app.stage;
      destroyPixiApp(app);

      // Verify teardown: stage, child layer, and graphics destroyed; app.stage nulled
      expect((stage as any).destroyed).toBe(true);
      expect((testLayer as any).destroyed).toBe(true);
      expect((g as any).destroyed).toBe(true);
      expect(app.stage).toBeNull();
      expect(app.renderer).toBeNull();
    });

    it('survives rapid create -> populate -> destroy recreation cycles without memory leak', async () => {
      for (let cycle = 0; cycle < 5; cycle++) {
        const app = new Application();
        await app.init({
          width: 960,
          height: 640,
          preference: 'canvas',
          autoStart: false,
        });

        const testContainer = new Container();
        for (let i = 0; i < 20; i++) {
          const shape = new Graphics();
          shape.rect(i * 5, 0, 4, 4);
          testContainer.addChild(shape);
        }
        app.stage.addChild(testContainer);

        expect(app.stage.children.length).toBe(1);
        expect(testContainer.children.length).toBe(20);

        const stage = app.stage;
        destroyPixiApp(app);
        expect((stage as any).destroyed).toBe(true);
      }
    });

    it('documents PixiJS v8 limitation: calling destroy twice throws because plugins are cleaned up', async () => {
      const app = new Application();
      await app.init({
        width: 960,
        height: 640,
        preference: 'canvas',
        autoStart: false,
      });

      destroyPixiApp(app);
      // Double destroy is not idempotent in PixiJS v8 without null check
      expect(() => {
        destroyPixiApp(app);
      }).toThrow(/_cancelResize|null/);
    });
  });

  // =========================================================================
  // 3. Simulation Ticker Integration & Frame Rate Variations
  // =========================================================================
  describe('3. Simulation Ticker Integration & Frame Rate Variations', () => {
    let sim: GameSimulation;

    beforeEach(() => {
      sim = new GameSimulation({ seed: 'challenger-ticker-42' });
      sim.addResource('gold', 100000);
      sim.buyFacility('fifi_broom', 10); // GPS > 0
    });

    it('guarantees tick accumulation across 60 FPS, 144 FPS, and 30 FPS within 1 tick margin', () => {
      const targetDurationMs = 10000; // 10 seconds = 200 ticks at 50ms

      // Run 1: Reference 60 FPS (~16.666ms per frame)
      const sim60 = new GameSimulation({ seed: 'fixed-seed' });
      sim60.addResource('gold', 100000);
      sim60.buyFacility('fifi_broom', 10);
      const goldStart60 = sim60.getState().currencies.gold;

      const frame60 = 1000 / 60;
      let elapsed60 = 0;
      while (elapsed60 + frame60 <= targetDurationMs) {
        sim60.tick(frame60);
        elapsed60 += frame60;
      }
      sim60.tick(targetDurationMs - elapsed60);

      // Run 2: 144 FPS (~6.944ms per frame)
      const sim144 = new GameSimulation({ seed: 'fixed-seed' });
      sim144.addResource('gold', 100000);
      sim144.buyFacility('fifi_broom', 10);
      const goldStart144 = sim144.getState().currencies.gold;

      const frame144 = 1000 / 144;
      let elapsed144 = 0;
      while (elapsed144 + frame144 <= targetDurationMs) {
        sim144.tick(frame144);
        elapsed144 += frame144;
      }
      sim144.tick(targetDurationMs - elapsed144);

      // Run 3: 30 FPS (~33.333ms per frame)
      const sim30 = new GameSimulation({ seed: 'fixed-seed' });
      sim30.addResource('gold', 100000);
      sim30.buyFacility('fifi_broom', 10);
      const goldStart30 = sim30.getState().currencies.gold;

      const frame30 = 1000 / 30;
      let elapsed30 = 0;
      while (elapsed30 + frame30 <= targetDurationMs) {
        sim30.tick(frame30);
        elapsed30 += frame30;
      }
      sim30.tick(targetDurationMs - elapsed30);

      const earned60 = sim60.getState().currencies.gold - goldStart60;
      const earned144 = sim144.getState().currencies.gold - goldStart144;
      const earned30 = sim30.getState().currencies.gold - goldStart30;

      expect(earned60).toBeGreaterThan(0);
      const oneTickValue = sim60.getTotalGPS() * 0.05;

      // EMPIRICAL FINDING: At 144 FPS, floating-point subtraction inaccuracy (49.99999999999915 ms)
      // leaves the 200th tick in the accumulator until the next frame. The difference is bounded to exactly <= 1 tick!
      expect(Math.abs(earned60 - earned144)).toBeLessThanOrEqual(oneTickValue + 0.001);
      expect(Math.abs(earned60 - earned30)).toBeLessThanOrEqual(oneTickValue + 0.001);
    });

    it('preserves accumulator fidelity under highly erratic random jitter deltas (1ms to 200ms)', () => {
      const simJitter = new GameSimulation({ seed: 'jitter-seed' });
      simJitter.addResource('gold', 50000);
      simJitter.buyFacility('fifi_broom', 5);
      const startGold = simJitter.getState().currencies.gold;

      let totalMs = 0;
      const targetMs = 5000; // 100 ticks
      while (totalMs < targetMs) {
        const step = Math.min(targetMs - totalMs, Math.floor(1 + Math.random() * 150));
        simJitter.tick(step);
        totalMs += step;
      }

      // 5 seconds at GPS
      const gps = simJitter.getTotalGPS();
      const earned = simJitter.getState().currencies.gold - startGold;
      expect(earned).toBeCloseTo(gps * 5, 1);
    });

    it('pausing ticker does not drop ticks or corrupt accumulated remainder', () => {
      const initialGold = sim.getState().currencies.gold;
      const gps = sim.getTotalGPS();

      // Step 1: Tick 35ms (accumulator = 35ms, 0 ticks)
      sim.tick(35);
      expect(sim.getState().currencies.gold).toBe(initialGold);

      // Step 2: Pause ticker for 5 simulated frames (0 deltaMs)
      for (let i = 0; i < 5; i++) {
        sim.tick(0);
      }
      expect(sim.getState().currencies.gold).toBe(initialGold);

      // Step 3: Resume ticker with 15ms (accumulator = 35 + 15 = 50ms -> exactly 1 tick)
      sim.tick(15);
      const expectedEarned = gps * 0.05;
      expect(sim.getState().currencies.gold - initialGold).toBeCloseTo(expectedEarned, 3);
    });

    it('handles clock rollback / negative deltaMs safely without negative resource generation', () => {
      const goldBefore = sim.getState().currencies.gold;
      sim.tick(-1000);
      expect(sim.getState().currencies.gold).toBe(goldBefore);
    });

    it('identifies vulnerability: NaN deltaMs poisons tickAccumulator permanently', () => {
      const goldBefore = sim.getState().currencies.gold;
      expect(sim.getTotalGPS()).toBeGreaterThan(0);

      // Passing NaN into tick
      sim.tick(NaN);

      // Subsequent valid ticks fail to advance because accumulator is NaN
      sim.tick(1000);
      const goldAfter = sim.getState().currencies.gold;

      // EMPIRICALLY CONFIRMED FAILURE MODE:
      // When tick(NaN) is invoked, tickAccumulator becomes NaN, causing all subsequent ticks to be dropped!
      const isBricked = goldAfter === goldBefore;
      expect(isBricked).toBe(true);
    });
  });
});
