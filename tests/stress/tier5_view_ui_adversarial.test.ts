// tests/stress/tier5_view_ui_adversarial.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Container, Graphics, Rectangle, Text, Texture, TextureSource } from 'pixi.js';

// ============================================================================
// Polyfills for Headless Node.js Environment
// ============================================================================
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}

if (typeof globalThis.CanvasRenderingContext2D === 'undefined') {
  class MockCanvasRenderingContext2D {
    public font = '';
    public fillText(): void {}
    public clearRect(): void {}
    public fillRect(): void {}
    public getImageData(): any { return { data: new Uint8ClampedArray(4) }; }
    public putImageData(): void {}
    public createImageData(): any { return { data: new Uint8ClampedArray(4) }; }
    public setTransform(): void {}
    public drawImage(): void {}
    public save(): void {}
    public restore(): void {}
    public measureText(text: string): any {
      return {
        width: (text || '').length * 8,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
      };
    }
  }
  (globalThis as any).CanvasRenderingContext2D = MockCanvasRenderingContext2D;
}

if (typeof globalThis.HTMLCanvasElement === 'undefined') {
  (globalThis as any).HTMLCanvasElement = class HTMLCanvasElement {};
}

if (typeof globalThis.document === 'undefined') {
  const ctx = new (globalThis as any).CanvasRenderingContext2D();
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: () => ctx,
          width: 960,
          height: 640,
          style: {},
          addEventListener: () => {},
          removeEventListener: () => {},
        };
      }
      return {
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
      };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// ============================================================================
// WebAudio API Mock Harness
// ============================================================================
class MockAudioParam {
  public value: number;
  public calls: Array<{ type: string; args: any[] }> = [];

  constructor(initial = 1.0) {
    this.value = initial;
  }

  public setValueAtTime(val: number, t: number): void {
    this.value = val;
    this.calls.push({ type: 'setValueAtTime', args: [val, t] });
  }

  public linearRampToValueAtTime(val: number, t: number): void {
    this.value = val;
    this.calls.push({ type: 'linearRampToValueAtTime', args: [val, t] });
  }

  public exponentialRampToValueAtTime(val: number, t: number): void {
    this.value = val;
    this.calls.push({ type: 'exponentialRampToValueAtTime', args: [val, t] });
  }

  public cancelScheduledValues(t: number): void {
    this.calls.push({ type: 'cancelScheduledValues', args: [t] });
  }
}

class MockAudioNode {
  public connectedTo: MockAudioNode[] = [];
  public isDisconnected = false;

  public connect(dest: MockAudioNode): void {
    this.connectedTo.push(dest);
    this.isDisconnected = false;
  }

  public disconnect(): void {
    this.connectedTo = [];
    this.isDisconnected = true;
  }
}

class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam(1.0);
}

class MockOscillatorNode extends MockAudioNode {
  public type: OscillatorType = 'sine';
  public frequency = new MockAudioParam(440);
  public onended: (() => void) | null = null;
  public isStarted = false;
  public isStopped = false;
  public startTime = 0;
  public stopTime = 0;

  public start(when = 0): void {
    this.isStarted = true;
    this.startTime = when;
  }

  public stop(when = 0): void {
    this.isStopped = true;
    this.stopTime = when;
  }

  public triggerEnded(): void {
    if (this.onended) {
      this.onended();
    }
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency = new MockAudioParam(1400);
  public Q = new MockAudioParam(0.7);
}

class MockAudioContext {
  public currentTime = 10.0;
  public state: AudioContextState = 'running';
  public destination = new MockAudioNode();
  public createdGains: MockGainNode[] = [];
  public createdOscillators: MockOscillatorNode[] = [];
  public createdFilters: MockBiquadFilterNode[] = [];
  public resumeCallCount = 0;
  public closeCallCount = 0;
  public shouldRejectResume = false;

  public createGain(): MockGainNode {
    const g = new MockGainNode();
    this.createdGains.push(g);
    return g;
  }

  public createOscillator(): MockOscillatorNode {
    const osc = new MockOscillatorNode();
    this.createdOscillators.push(osc);
    return osc;
  }

  public createBiquadFilter(): MockBiquadFilterNode {
    const filter = new MockBiquadFilterNode();
    this.createdFilters.push(filter);
    return filter;
  }

  public async resume(): Promise<void> {
    this.resumeCallCount++;
    if (this.shouldRejectResume) {
      throw new Error('Autoplay policy: user interaction required');
    }
    this.state = 'running';
  }

  public async close(): Promise<void> {
    this.closeCallCount++;
    this.state = 'closed';
  }
}

// ============================================================================
// Imports from Game Core, Render, Audio, and UI
// ============================================================================
import { GameSimulation } from '../../src/core/simulation';
import { AudioEngine } from '../../src/audio/engine';
import { playProceduralSfx } from '../../src/audio/sfx';
import { ProceduralBgmPlayer } from '../../src/audio/bgm';
import type { SfxType } from '../../src/audio/types';

import type { GameAssets } from '../../src/render/assets';
import { sliceCharacterSheet, sliceGroundBlocks, sliceBuildings, sliceTrees } from '../../src/render/assets';
import { WorldView } from '../../src/render/world';
import { MaidSprite } from '../../src/render/maids';
import { EstateView } from '../../src/render/estate';
import { CreaturesManager, CreatureSprite, HABITAT_CONFIGS, ZONE_WILD_ROAM_BOUNDS } from '../../src/render/creatures';
import { EffectsManager } from '../../src/render/effects';

import {
  HudDrawer,
  SoundControls,
  SpeechBubble,
  StoryModal,
  ChoresTab,
  MultipliersTab,
  TerritoryTab,
  SanctuaryTab,
  PixelButton,
  PixelPanel,
  STORY_SEQUENCES,
  NYAH_AMBIENT_QUOTES,
  FIFI_AMBIENT_QUOTES,
  getNextPendingMilestone,
} from '../../src/ui';
import { CREATURE_SPECIES, HABITATS } from '../../src/core/creatures';
import { FIFI_FACILITIES } from '../../src/core/facilities';
import { NYAH_MULTIPLIERS } from '../../src/core/multipliers';
import { TERRITORY_ZONES } from '../../src/core/territory';

// Helper to create mock textures and assets
function makeMockTexture(width: number, height: number): Texture {
  const source = new TextureSource({ width, height });
  return new Texture({ source, frame: new Rectangle(0, 0, width, height) });
}

function makeMockGameAssets(): GameAssets {
  const nyahSheet = makeMockTexture(144, 192);
  const fifiSheet = makeMockTexture(144, 192);
  const blocksTex = makeMockTexture(256, 64);
  const bldgTex = makeMockTexture(340, 300);
  const treeTex = makeMockTexture(72, 49);
  const dummy = makeMockTexture(32, 32);

  return {
    nyahWorld: sliceCharacterSheet(nyahSheet),
    fifiWorld: sliceCharacterSheet(fifiSheet),
    nyahPortraitNative: dummy,
    fifiPortraitNative: dummy,
    nyahPortraitFull: dummy,
    fifiPortraitFull: dummy,
    groundTiles: sliceGroundBlocks(blocksTex),
    buildings: sliceBuildings(bldgTex),
    trees: sliceTrees(treeTex),
  };
}

function makeMockPixiApp(): any {
  const stage = new Container({ label: 'mock-stage' });
  return {
    stage,
    screen: { width: 960, height: 640 },
  };
}

// ============================================================================
// TIER 5 ADVERSARIAL STRESS SUITE
// ============================================================================
describe('Tier 5 Adversarial Coverage Hardening: View, Audio, Dialogue and UI', () => {
  let sim: GameSimulation;
  let assets: GameAssets;

  beforeEach(() => {
    sim = new GameSimulation({ seed: 7777 });
    assets = makeMockGameAssets();
  });

  // =========================================================================
  // 1. Audio Engine & Procedural Synth Adversarial Lifecycle
  // =========================================================================
  describe('1. Audio Engine & Procedural Synth Adversarial Lifecycle', () => {
    it('AudioEngine init() is idempotent under repeated and concurrent calls', async () => {
      const audio = new AudioEngine();
      // Concurrent init invocations
      await Promise.all([audio.init(), audio.init(), audio.init()]);
      expect(audio.isAvailable()).toBe(false); // headless node fallback safe
      audio.destroy();
    });

    it('AudioEngine destroy() is safe to call repeatedly and makes subsequent calls no-ops', () => {
      const audio = new AudioEngine();
      audio.destroy();
      audio.destroy(); // re-entrant destroy

      // Calling methods after destroy does not crash
      expect(() => audio.playSfx('coin')).not.toThrow();
      expect(() => audio.startBgm()).not.toThrow();
      expect(() => audio.stopBgm()).not.toThrow();
      expect(() => audio.setMasterVolume(0.5)).not.toThrow();
    });

    it('volume clamping strictly normalizes NaN, Infinities, and out-of-range bounds', () => {
      const audio = new AudioEngine();

      audio.setMasterVolume(NaN);
      expect(audio.getSettings().masterVolume).toBe(0.0);

      audio.setMasterVolume(Infinity);
      expect(audio.getSettings().masterVolume).toBe(1.0);

      audio.setMasterVolume(-Infinity);
      expect(audio.getSettings().masterVolume).toBe(0.0);

      audio.setBgmVolume(9999);
      expect(audio.getSettings().bgmVolume).toBe(1.0);

      audio.setBgmVolume(-500);
      expect(audio.getSettings().bgmVolume).toBe(0.0);

      audio.setSfxVolume(0.42);
      expect(audio.getSettings().sfxVolume).toBe(0.42);
    });

    it('ProceduralBgmPlayer survives rapid start and stop bursts without leaked timers or nodes', () => {
      const player = new ProceduralBgmPlayer();
      const mockCtx = new MockAudioContext();
      const dest = new MockAudioNode();

      // Rapid alternating start / stop
      for (let i = 0; i < 50; i++) {
        player.start(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
        player.stop();
      }

      // Assert clean state after rapid stopping
      expect((player as any).isPlaying).toBe(false);
      expect((player as any).timerId).toBeNull();
      expect((player as any).activeNodes).toHaveLength(0);
      expect((player as any).filterNode).toBeNull();

      // Start once more and verify single filter node created
      player.start(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect((player as any).isPlaying).toBe(true);
      expect((player as any).filterNode).not.toBeNull();
      player.stop();
    });

    it('survives 700 concurrent procedural SFX calls across all 7 types with 100% graph disconnection', () => {
      const mockCtx = new MockAudioContext();
      const dest = new MockAudioNode();
      const types: SfxType[] = ['click', 'coin', 'upgrade', 'catch', 'fanfare', 'frenzy', 'petting'];

      for (let i = 0; i < 700; i++) {
        const type = types[i % types.length];
        playProceduralSfx(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, type);
      }

      expect(mockCtx.createdOscillators.length).toBeGreaterThanOrEqual(700);
      expect(mockCtx.createdGains.length).toBeGreaterThanOrEqual(700);

      // Trigger onended callbacks on all created oscillators
      mockCtx.createdOscillators.forEach((osc) => {
        expect(osc.isStarted).toBe(true);
        expect(osc.isStopped).toBe(true);
        osc.triggerEnded();
      });

      // Verify all oscillators and gains disconnected cleanly
      const connectedOscs = mockCtx.createdOscillators.filter((o) => !o.isDisconnected);
      const connectedGains = mockCtx.createdGains.filter((g) => !g.isDisconnected);

      expect(connectedOscs).toHaveLength(0);
      expect(connectedGains).toHaveLength(0);
    });

    it('AudioEngine recovers safely when AudioContext.resume() rejects due to browser policies', async () => {
      const mockCtx = new MockAudioContext();
      mockCtx.state = 'suspended';
      mockCtx.shouldRejectResume = true;

      const audio = new AudioEngine();
      (audio as any).ctx = mockCtx;
      (audio as any).sfxGain = mockCtx.createGain();

      // Invoking playSfx triggers resume() which rejects, but must not crash
      expect(() => audio.playSfx('click')).not.toThrow();
      expect(mockCtx.resumeCallCount).toBe(1);

      audio.destroy();
    });
  });

  // =========================================================================
  // 2. WorldView, Camera Navigation & Drag-to-Pan Adversarial Invariants
  // =========================================================================
  describe('2. WorldView, Camera Navigation & Drag-to-Pan Adversarial Invariants', () => {
    let app: any;
    let worldView: WorldView;
    let worldClickRecord: Array<{ worldX: number; worldY: number }> = [];

    beforeEach(() => {
      app = makeMockPixiApp();
      worldClickRecord = [];
      worldView = new WorldView({
        app,
        assets,
        simulation: sim,
        onWorldClick: (worldX, worldY) => {
          worldClickRecord.push({ worldX, worldY });
        },
      });
    });

    afterEach(() => {
      if (app && app.stage) {
        app.stage.destroy({ children: true });
      }
    });

    it('initializes camera position and snaps coordinates accurately', () => {
      worldView.centerCameraOnEstate();
      expect(worldView.cameraX).toBe(0);
      expect(worldView.cameraY).toBe(10);
      expect(worldView.worldContainer.scale.x).toBe(2);
      expect(worldView.worldContainer.scale.y).toBe(2);
    });

    it('enforces camera boundary clamping under extreme pointer movements', () => {
      const stage = app.stage;

      // 1. Pointer down at center
      stage.emit('pointerdown', { global: { x: 480, y: 320 } });

      // 2. Extreme drag movement to the right (dx = 50,000)
      stage.emit('pointermove', { global: { x: 50480, y: 320 } });
      expect(worldView.targetCameraX).toBeLessThanOrEqual(worldView.cameraBounds.maxX);
      expect(worldView.targetCameraX).toBeGreaterThanOrEqual(worldView.cameraBounds.minX);

      // 3. Extreme drag movement to the top (dy = -50,000)
      stage.emit('pointermove', { global: { x: 480, y: -49680 } });
      expect(worldView.targetCameraY).toBeLessThanOrEqual(worldView.cameraBounds.maxY);
      expect(worldView.targetCameraY).toBeGreaterThanOrEqual(worldView.cameraBounds.minY);

      stage.emit('pointerup', { global: { x: 480, y: -49680 } });
    });

    it('distinguishes click from drag: drag suppresses world click, static tap invokes click', () => {
      const stage = app.stage;

      // Scenario A: Static click (movement <= 4px)
      stage.emit('pointerdown', { global: { x: 480, y: 320 } });
      stage.emit('pointermove', { global: { x: 482, y: 321 } }); // 2.2px move
      stage.emit('pointerup', { global: { x: 482, y: 321 } });
      expect(worldClickRecord).toHaveLength(1);

      // Scenario B: Significant drag (movement > 4px)
      stage.emit('pointerdown', { global: { x: 480, y: 320 } });
      stage.emit('pointermove', { global: { x: 520, y: 360 } }); // > 50px move
      stage.emit('pointerup', { global: { x: 520, y: 360 } });
      expect(worldClickRecord).toHaveLength(1); // Click was suppressed, count remains 1
    });

    it('pointerupoutside terminates dragging so subsequent moves are ignored', () => {
      const stage = app.stage;
      stage.emit('pointerdown', { global: { x: 480, y: 320 } });
      stage.emit('pointerupoutside', { global: { x: 480, y: 320 } });

      const prevTargetX = worldView.targetCameraX;
      stage.emit('pointermove', { global: { x: 800, y: 600 } });
      expect(worldView.targetCameraX).toBe(prevTargetX);
    });

    it('camera lerp converges smoothly under update() ticks', () => {
      worldView.cameraX = 0;
      worldView.targetCameraX = 100;

      for (let i = 0; i < 30; i++) {
        worldView.update(0.016, sim.getState());
      }

      // After 30 frames of lerp (factor 0.2), cameraX should be within 1px of 100
      expect(Math.abs(worldView.cameraX - 100)).toBeLessThan(1.0);
    });
  });

  // =========================================================================
  // 3. Maid Character Sprite State Machine & Autonomous AI Stress
  // =========================================================================
  describe('3. Maid Character Sprite State Machine & Autonomous AI Stress', () => {
    let nyah: MaidSprite;
    let fifi: MaidSprite;

    beforeEach(() => {
      nyah = new MaidSprite({
        name: 'nyah',
        frames: assets.nyahWorld,
        x: 0,
        y: 20,
        direction: 'down',
      });

      fifi = new MaidSprite({
        name: 'fifi',
        frames: assets.fifiWorld,
        x: -40,
        y: 40,
        direction: 'right',
      });
    });

    afterEach(() => {
      nyah.destroy({ children: true });
      fifi.destroy({ children: true });
    });

    it('handles moveTo(x, y) with zero distance without crashing or stalling', () => {
      nyah.x = 50;
      nyah.y = 50;
      // Command move to exact current location
      nyah.moveTo(50, 50);
      nyah.update(0.016);
      expect((nyah as any).currentState).toBe('chore');
      expect((nyah as any).moveTarget).toBeNull();
    });

    it('orients direction and sprite flipping correctly for 4 cardinal paths', () => {
      // East (right): scale.x = -1
      nyah.moveTo(100, 20);
      expect((nyah as any).currentDirection).toBe('right');
      expect((nyah as any).animSprite.scale.x).toBe(-1);

      // West (left): scale.x = 1
      nyah.moveTo(-100, 20);
      expect((nyah as any).currentDirection).toBe('left');
      expect((nyah as any).animSprite.scale.x).toBe(1);

      // South (down)
      nyah.moveTo(0, 100);
      expect((nyah as any).currentDirection).toBe('down');
      expect((nyah as any).animSprite.scale.x).toBe(1);

      // North (up)
      nyah.moveTo(0, -100);
      expect((nyah as any).currentDirection).toBe('up');
      expect((nyah as any).animSprite.scale.x).toBe(1);
    });

    it('survives extreme frame delta variations (zero delta and 120s sleep leap)', () => {
      nyah.setWanderBounds(-100, 100, -100, 100);
      nyah.moveTo(80, 80);

      // Zero delta
      expect(() => nyah.update(0)).not.toThrow();

      // Huge delta (120s tab sleep catchup)
      expect(() => nyah.update(120.0)).not.toThrow();
      expect(Number.isFinite(nyah.x)).toBe(true);
      expect(Number.isFinite(nyah.y)).toBe(true);
      expect(nyah.zIndex).toBe(Math.floor(nyah.y));
    });

    it('pointer click interrupts autonomous wandering, faces down and invokes callback', () => {
      let clickCount = 0;
      nyah.setClickHandler(() => {
        clickCount++;
      });
      nyah.moveTo(100, 100);

      // Trigger pointer click
      (nyah as any).handlePointerClick();
      expect(clickCount).toBe(1);
      expect((nyah as any).currentState).toBe('chore');
      expect((nyah as any).currentDirection).toBe('down');
      expect((nyah as any).aiTimer).toBe(2.5);
    });

    it('getSpeechAnchorWorld computes valid integer coordinates above character head', () => {
      nyah.position.set(120, 240);
      const anchor = nyah.getSpeechAnchorWorld();
      expect(anchor.x).toBe(120);
      expect(anchor.y).toBe(240 - 52); // y - 52px head offset
    });
  });

  // =========================================================================
  // 4. Estate Multi-Phase Progression, Zone Visuals & Mist Dynamics
  // =========================================================================
  describe('4. Estate Multi-Phase Progression, Zone Visuals & Mist Dynamics', () => {
    let groundLayer: Container;
    let entityLayer: Container;
    let effectsManager: EffectsManager;
    let estateView: EstateView;
    let structureClicks: Array<{ structure: string; x: number; y: number }> = [];

    beforeEach(() => {
      groundLayer = new Container();
      entityLayer = new Container({ sortableChildren: true });
      effectsManager = new EffectsManager();
      structureClicks = [];

      estateView = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
        onStructureClick: (structure, x, y) => {
          structureClicks.push({ structure, x, y });
        },
      });
    });

    afterEach(() => {
      effectsManager.clear();
      groundLayer.destroy({ children: true });
      entityLayer.destroy({ children: true });
    });

    it('strictly clamps mansion tiers and synchronizes wing visibility', () => {
      // Out of bounds lower
      estateView.updateMansionTier(-5);
      expect(estateView.currentTier).toBe(1);
      expect((estateView as any).mansionWestWing.visible).toBe(false);
      expect((estateView as any).mansionEastWing.visible).toBe(false);
      expect((estateView as any).mansionObservatoryDome.visible).toBe(false);

      // Tier 4: West wing becomes visible
      estateView.updateMansionTier(4);
      expect(estateView.currentTier).toBe(4);
      expect((estateView as any).mansionWestWing.visible).toBe(true);
      expect((estateView as any).mansionEastWing.visible).toBe(false);
      expect((estateView as any).mansionObservatoryDome.visible).toBe(false);

      // Tier 5: All wings and dome visible
      estateView.updateMansionTier(5);
      expect(estateView.currentTier).toBe(5);
      expect((estateView as any).mansionWestWing.visible).toBe(true);
      expect((estateView as any).mansionEastWing.visible).toBe(true);
      expect((estateView as any).mansionObservatoryDome.visible).toBe(true);

      // Out of bounds upper
      estateView.updateMansionTier(999);
      expect(estateView.currentTier).toBe(5);
    });

    it('handles out-of-order and powerset territory unlock permutations cleanly', () => {
      // Unlock all 5 zones in reverse order
      const reverseZones = [
        'zone_05_starlight_observatory',
        'zone_04_library_balcony',
        'zone_03_pond_courtyard',
        'zone_02_kitchen_garden',
        'zone_01_parlor',
      ];
      estateView.setUnlockedZones(reverseZones, false);
      expect(estateView.currentTier).toBe(5);

      const bounds = estateView.getCombinedUnlockedBounds();
      expect(bounds.minX).toBeLessThanOrEqual(-544);
      expect(bounds.maxX).toBeGreaterThanOrEqual(544);
      expect(bounds.minY).toBeLessThanOrEqual(-480);
      expect(bounds.maxY).toBeGreaterThanOrEqual(480);
    });

    it('animates mist alpha fade down to 0 and disables mist container', () => {
      // Trigger unlock with animation
      estateView.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden'], true);
      const zone2 = (estateView as any).zones.get('zone_02_kitchen_garden');
      expect(zone2.isFadingMist).toBe(true);
      expect(zone2.mistAlpha).toBe(1.0);

      // Advance frames (1.5 alpha/sec -> ~0.7s to reach 0)
      for (let i = 0; i < 50; i++) {
        estateView.update(0.016);
      }

      expect(zone2.mistAlpha).toBe(0);
      expect(zone2.isFadingMist).toBe(false);
      expect(zone2.mistContainer.visible).toBe(false);
    });

    it('routes interactive structure clicks accurately across all 5 estate structures', () => {
      const mansionSprite = (estateView as any).mansionMainSprite;
      const fountainSprite = (estateView as any).fountainSprite;
      const westWing = (estateView as any).mansionWestWing;
      const dome = (estateView as any).mansionObservatoryDome;

      const mockPointerEvent = (x: number, y: number) => ({
        global: { x, y },
        stopPropagation: () => {},
      });

      mansionSprite.emit('pointerdown', mockPointerEvent(0, 0));
      fountainSprite.emit('pointerdown', mockPointerEvent(20, 300));
      westWing.emit('pointerdown', mockPointerEvent(-240, -10));
      dome.emit('pointerdown', mockPointerEvent(16, -360));

      expect(structureClicks).toHaveLength(4);
      expect(structureClicks[0].structure).toBe('mansion');
      expect(structureClicks[1].structure).toBe('fountain');
      expect(structureClicks[2].structure).toBe('library');
      expect(structureClicks[3].structure).toBe('observatory');
    });
  });

  // =========================================================================
  // 5. Creature Pixel Art Rendering, Wild Spawning & Habitat Roaming Stress
  // =========================================================================
  describe('5. Creature Pixel Art Rendering, Wild Spawning & Habitat Roaming Stress', () => {
    let entityLayer: Container;
    let effectsManager: EffectsManager;
    let creaturesManager: CreaturesManager;

    beforeEach(() => {
      entityLayer = new Container({ sortableChildren: true });
      effectsManager = new EffectsManager();
      creaturesManager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation: sim,
      });
    });

    afterEach(() => {
      effectsManager.clear();
      entityLayer.destroy({ children: true });
    });

    it('renders bespoke pixel art geometries for all 10 original species in standard and shiny modes', () => {
      CREATURE_SPECIES.forEach((spec) => {
        // Standard variant
        const normal = new CreatureSprite({ speciesId: spec.id, isShiny: false });
        expect(normal.creatureGraphics).toBeDefined();
        expect(normal.shinyAura).toBeUndefined();
        expect(normal.visualContainer.children.length).toBeGreaterThanOrEqual(1);

        // Shiny variant
        const shiny = new CreatureSprite({ speciesId: spec.id, isShiny: true });
        expect(shiny.shinyAura).toBeDefined();
        expect(shiny.isShiny).toBe(true);

        normal.destroy({ children: true });
        shiny.destroy({ children: true });
      });
    });

    it('strictly throws error if an unrecognized speciesId is requested', () => {
      expect(() => {
        new CreatureSprite({ speciesId: 'missing_mythic_pokemon_clone' });
      }).toThrow(/Unknown creature speciesId/);
    });

    it('synchronizes wild creatures spawning, autonomous roaming, and fleeing lifecycle', () => {
      sim.getState().creatures.wildActive = [
        { id: 'wild_001', speciesId: 'purrble', zoneId: 'zone_01_parlor', x: 20, y: 10, timer: 30 },
        { id: 'wild_002', speciesId: 'barkling', zoneId: 'zone_01_parlor', x: -30, y: 20, timer: 30 },
      ];

      creaturesManager.update(0.016, sim.getState());
      expect(creaturesManager.getWildCreatures()).toHaveLength(2);

      // Despawn wild_001
      sim.getState().creatures.wildActive = [
        { id: 'wild_002', speciesId: 'barkling', zoneId: 'zone_01_parlor', x: -30, y: 20, timer: 30 },
      ];
      creaturesManager.update(0.016, sim.getState());

      // wild_001 begins fleeing (alpha fading)
      const wild1 = (creaturesManager as any).wildSprites.get('wild_001');
      expect((wild1 as any).isFleeing).toBe(true);

      // Advance frames to complete flee
      for (let i = 0; i < 30; i++) {
        creaturesManager.update(0.033, sim.getState());
      }
      expect(creaturesManager.getWildCreatures()).toHaveLength(1);
      expect(creaturesManager.getWildCreatures()[0].speciesId).toBe('barkling');
    });

    it('handleWildClick processes catch roll with bait and triggers celebrate or flee feedback', () => {
      sim.getState().currencies.treats = 5; // Bait available
      sim.getState().creatures.wildActive = [
        { id: 'wild_catch_test', speciesId: 'purrble', zoneId: 'zone_01_parlor', x: 0, y: 0, timer: 30 },
      ];
      creaturesManager.update(0.016, sim.getState());

      const wildSprite = (creaturesManager as any).wildSprites.get('wild_catch_test');
      expect(wildSprite).toBeDefined();

      const result = creaturesManager.handleWildClick(wildSprite!);
      expect(result).toHaveProperty('success');
      expect(result.speciesId).toBe('purrble');

      if (result.success) {
        expect((creaturesManager as any).wildSprites.has('wild_catch_test')).toBe(false);
      }
    });

    it('enforces habitat capacity caps and gates rendering behind territory unlock', () => {
      // Catch 10 Purrbles and assign to porch (capacity 3)
      sim.getState().creatures.caught['purrble'] = {
        count: 10,
        level: 1,
        assignedHabitat: 'habitat_porch',
        xp: 0,
        isShiny: false,
      };

      creaturesManager.setUnlockedZones(['zone_01_parlor']);
      creaturesManager.update(0.016, sim.getState());

      const porchCreatures = creaturesManager.getHabitatCreatures('habitat_porch');
      // Capacity is 3, spawns up to min(2, count) per species = 2
      expect(porchCreatures.length).toBeLessThanOrEqual(HABITAT_CONFIGS.habitat_porch.capacity);
      expect(porchCreatures.length).toBe(2);

      // If zone 1 is locked, habitat creatures must immediately disappear
      creaturesManager.setUnlockedZones([]);
      creaturesManager.update(0.016, sim.getState());
      expect(creaturesManager.getHabitatCreatures('habitat_porch')).toHaveLength(0);
    });

    it('petting habitat creatures spawns bespoke heartwarming quotes for all species', () => {
      CREATURE_SPECIES.forEach((spec) => {
        const sprite = new CreatureSprite({ speciesId: spec.id, isShiny: false });
        expect(() => (creaturesManager as any).handleHabitatPetting(sprite)).not.toThrow();
        sprite.destroy({ children: true });
      });
    });
  });

  // =========================================================================
  // 6. UI Drawer, Tabs, SoundControls, SpeechBubbles & Dialogue Sequences
  // =========================================================================
  describe('6. UI Drawer, Tabs, SoundControls, SpeechBubbles & Dialogue Sequences', () => {
    it('HudDrawer survives 200 rapid toggle spam cycles with monotonic lerp convergence', () => {
      const audio = new AudioEngine();
      const drawer = new HudDrawer({ simulation: sim, audio });

      // Rapid toggle spam
      for (let i = 0; i < 200; i++) {
        drawer.toggle();
      }

      // Final desired state: open
      drawer.toggle(true);
      expect(drawer.isOpen).toBe(true);

      // Update over 1 second of frames
      for (let i = 0; i < 60; i++) {
        drawer.update(0.016);
      }

      expect(drawer.position.y).toBe(260); // fully expanded position

      drawer.destroy({ children: true });
      audio.destroy();
    });

    it('SpeechBubble enforces strict horizontal boundaries [10, 950] for off-screen anchors', () => {
      let anchor = { x: -500, y: 100 };
      const bubble = new SpeechBubble({
        speaker: 'nyah',
        getAnchorPos: () => anchor,
      });

      // Far left off-screen anchor
      bubble.show('Off-screen left test');
      const halfW = Math.floor((bubble as any).bubbleWidth / 2);
      expect(bubble.position.x).toBeGreaterThanOrEqual(halfW + 10);

      // Far right off-screen anchor
      anchor = { x: 1500, y: 100 };
      (bubble as any).updatePosition();
      expect(bubble.position.x).toBeLessThanOrEqual(950 - halfW);

      bubble.destroy({ children: true });
    });

    it('SpeechBubble lifecycle advances cleanly through fade-in, hold, and fade-out', () => {
      const bubble = new SpeechBubble({
        speaker: 'fifi',
        getAnchorPos: () => ({ x: 480, y: 300 }),
      });

      bubble.show('Sweeping the walkway, Master!', 1.0);
      expect(bubble.visible).toBe(true);
      expect(bubble.alpha).toBe(1);

      // Update 0.5s -> stays visible
      bubble.update(0.5);
      expect(bubble.visible).toBe(true);
      expect(bubble.alpha).toBe(1);

      // Update past maxLife (1.0s) -> starts fading out
      bubble.update(0.6);
      expect((bubble as any).fadeTimer).toBeGreaterThan(0);

      // Update past fade finish
      bubble.update(0.3);
      expect(bubble.visible).toBe(false);
      expect(bubble.alpha).toBe(0);

      bubble.destroy({ children: true });
    });

    it('StoryModal typewriter advances correctly and skips instantly on user click', () => {
      const modal = new StoryModal({
        nyahPortrait: Texture.EMPTY,
        fifiPortrait: Texture.EMPTY,
      });

      const seq = STORY_SEQUENCES[0];
      modal.playSequence(seq);
      expect(modal.isShowing()).toBe(true);
      expect((modal as any).isTyping).toBe(true);

      // Advance typewriter by a few characters
      modal.update(0.1);
      const partialLen = (modal as any).displayedCharCount;
      expect(partialLen).toBeGreaterThan(0);
      expect(partialLen).toBeLessThan((modal as any).fullLineText.length);

      // Click dialog box to instantly finish typewriter
      (modal as any).handleBoxClick();
      expect((modal as any).isTyping).toBe(false);
      expect((modal as any).displayedCharCount).toBe((modal as any).fullLineText.length);

      modal.destroy({ children: true });
    });

    it('cycles through all 8 story sequences from beginning to end without errors', () => {
      const modal = new StoryModal({
        nyahPortrait: Texture.EMPTY,
        fifiPortrait: Texture.EMPTY,
      });

      STORY_SEQUENCES.forEach((seq) => {
        let completed = false;
        modal.playSequence(seq, () => {
          completed = true;
        });

        // Each line has typewriter phase then next line phase
        for (let i = 0; i < (seq.lines.length + 1) * 2; i++) {
          (modal as any).handleNext();
        }

        expect(completed).toBe(true);
        expect(modal.isShowing()).toBe(false);
      });

      modal.destroy({ children: true });
    });

    it('SoundControls updates volume levels and labels to lower and upper bounds', () => {
      const audio = new AudioEngine();
      let volumeChanged = false;
      const controls = new SoundControls({
        audio,
        onVolumeChange: () => {
          volumeChanged = true;
        },
      });

      // Find Master [+] button
      const masterPlus = controls.children.find(
        (c: any) => c.btnText === '+' && c.position.x < 200
      ) as PixelButton;
      expect(masterPlus).toBeDefined();

      // Click master plus 15 times
      for (let i = 0; i < 15; i++) {
        (masterPlus as any).onClickHandler();
      }
      expect(audio.getSettings().masterVolume).toBe(1.0);
      expect((controls as any).masterText.text).toBe('Mst:100%');

      // Find Master [-] button
      const masterMinus = controls.children.find(
        (c: any) => c.btnText === '-' && c.position.x < 100
      ) as PixelButton;
      expect(masterMinus).toBeDefined();

      // Click master minus 15 times
      for (let i = 0; i < 15; i++) {
        (masterMinus as any).onClickHandler();
      }
      expect(audio.getSettings().masterVolume).toBe(0.0);
      expect((controls as any).masterText.text).toBe('Mst:0%');

      expect(volumeChanged).toBe(true);

      controls.destroy({ children: true });
      audio.destroy();
    });

    it('ChoresTab supports bulk buy modes 1x, 10x, 25x, and MAX with state synchronization', () => {
      const tab = new ChoresTab(sim);
      expect(tab.getBulkMode()).toBe(1);

      tab.setBulkMode(10);
      expect(tab.getBulkMode()).toBe(10);

      tab.setBulkMode(25);
      expect(tab.getBulkMode()).toBe(25);

      tab.setBulkMode(-1); // MAX
      expect(tab.getBulkMode()).toBe(-1);

      // Add gold and verify MAX affordability calculation runs cleanly
      sim.addResource('gold', 10000);
      tab.update();

      const broomCard = (tab as any).cardViews.find((c: any) => c.id === 'fifi_broom');
      expect(broomCard.buyBtn.disabled).toBe(false);
      expect(broomCard.buyBtn.btnText).toMatch(/Buy \+\d+/);

      tab.destroy({ children: true });
    });

    it('SanctuaryTab permits assigning and unassigning creatures with zone gating and header capacity tracking', () => {
      const tab = new SanctuaryTab(sim);

      // 1. Purrble prefers habitat_porch (zone_01_parlor is unlocked by default)
      sim.getState().creatures.caught['purrble'] = {
        count: 1,
        level: 1,
        assignedHabitat: undefined,
        xp: 0,
        isShiny: false,
      };
      tab.update();

      const purrbleCard = (tab as any).cardViews.find((c: any) => c.id === 'purrble');
      expect(purrbleCard).toBeDefined();
      expect(purrbleCard.assignBtn.btnText).toBe('Assign');

      // Click assign for Purrble -> succeeds to habitat_porch
      (purrbleCard.assignBtn as any).onClickHandler();
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBe('habitat_porch');

      tab.update();
      expect(purrbleCard.assignBtn.btnText).toBe('Assigned');

      // Click unassign for Purrble -> clears assignedHabitat
      (purrbleCard.assignBtn as any).onClickHandler();
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBeUndefined();

      // 2. Mooshrum prefers habitat_garden (zone_02_kitchen_garden)
      sim.getState().creatures.caught['mooshrum'] = {
        count: 1,
        level: 1,
        assignedHabitat: undefined,
        xp: 0,
        isShiny: false,
      };

      // When zone 2 is locked, assigning Mooshrum fails
      const mooshrumCard = (tab as any).cardViews.find((c: any) => c.id === 'mooshrum');
      (mooshrumCard.assignBtn as any).onClickHandler();
      expect(sim.getState().creatures.caught['mooshrum'].assignedHabitat).toBeUndefined();

      // Unlock zone 2
      sim.getState().territory.unlockedZones.push('zone_02_kitchen_garden');
      (mooshrumCard.assignBtn as any).onClickHandler();
      expect(sim.getState().creatures.caught['mooshrum'].assignedHabitat).toBe('habitat_garden');

      tab.destroy({ children: true });
    });
  });
});
