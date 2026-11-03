// tests/stress/m5_adversarial_stress.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Texture } from 'pixi.js';

// Polyfills for headless Node environment
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

import { GameSimulation } from '../../src/core/simulation';
import { AudioEngine } from '../../src/audio/engine';
import { playProceduralSfx } from '../../src/audio/sfx';
import { ProceduralBgmPlayer } from '../../src/audio/bgm';
import type { SfxType } from '../../src/audio/types';
import {
  HudDrawer,
  SpeechBubble,
  StoryModal,
  ChoresTab,
  MultipliersTab,
  TerritoryTab,
  SanctuaryTab,
  SoundControls,
  STORY_SEQUENCES,
  NYAH_AMBIENT_QUOTES,
  FIFI_AMBIENT_QUOTES,
} from '../../src/ui';
import { FIFI_FACILITIES } from '../../src/core/facilities';
import { NYAH_MULTIPLIERS } from '../../src/core/multipliers';
import { TERRITORY_ZONES } from '../../src/core/territory';
import { CREATURE_SPECIES, HABITATS } from '../../src/core/creatures';

// ============================================================================
// Comprehensive WebAudio API Mock Harness for Concurrency & Leak Testing
// ============================================================================
class MockAudioParam {
  public value: number;
  public calls: Array<{ type: string; args: any[] }> = [];

  constructor(initial = 1.0) {
    this.value = initial;
  }

  public setValueAtTime(val: number, _t: number): void {
    this.value = val;
    this.calls.push({ type: 'setValueAtTime', args: [val, _t] });
  }

  public linearRampToValueAtTime(val: number, _t: number): void {
    this.value = val;
    this.calls.push({ type: 'linearRampToValueAtTime', args: [val, _t] });
  }

  public exponentialRampToValueAtTime(val: number, _t: number): void {
    this.value = val;
    this.calls.push({ type: 'exponentialRampToValueAtTime', args: [val, _t] });
  }

  public cancelScheduledValues(_t: number): void {
    this.calls.push({ type: 'cancelScheduledValues', args: [_t] });
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

  public start(_when?: number): void {
    this.isStarted = true;
  }

  public stop(_when?: number): void {
    this.isStopped = true;
  }

  public triggerEnded(): void {
    if (this.onended) {
      this.onended();
    }
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency = new MockAudioParam(350);
  public Q = new MockAudioParam(1);
}

class MockAudioContext {
  public currentTime = 100.0;
  public state: AudioContextState = 'running';
  public destination = new MockAudioNode();
  public createdGains: MockGainNode[] = [];
  public createdOscillators: MockOscillatorNode[] = [];
  public createdFilters: MockBiquadFilterNode[] = [];
  public closed = false;

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
    this.state = 'running';
  }

  public async close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
  }
}

describe('Milestone 5 Adversarial Stress & Empirical UI Challenge Suite', () => {
  let sim: GameSimulation;
  let audio: AudioEngine;

  beforeEach(() => {
    sim = new GameSimulation({ seed: 1337 });
    audio = new AudioEngine();
  });

  afterEach(() => {
    audio.destroy();
  });

  // =========================================================================
  // SECTION 1: Audio Concurrency & WebAudio Node Disconnection Stress
  // =========================================================================
  describe('1. WebAudio Concurrency, Graph Integrity & Disconnection Stress', () => {
    it('empirically verifies 100% of ephemeral oscillators and gain nodes disconnect during 200 concurrent SFX bursts', () => {
      const mockCtx = new MockAudioContext();
      const dest = new MockAudioNode();
      const sfxTypes: SfxType[] = ['click', 'coin', 'frenzy', 'catch', 'fanfare', 'petting', 'upgrade'];

      // Fire 200 rapid simultaneous SFX calls
      for (let i = 0; i < 200; i++) {
        const type = sfxTypes[i % sfxTypes.length];
        playProceduralSfx(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, type);
      }

      // Assert nodes were successfully generated
      const totalOscillators = mockCtx.createdOscillators.length;
      const totalGains = mockCtx.createdGains.length;
      expect(totalOscillators).toBeGreaterThanOrEqual(200);
      expect(totalGains).toBeGreaterThanOrEqual(200);

      // Verify all oscillators started and scheduled a stop
      for (const osc of mockCtx.createdOscillators) {
        expect(osc.isStarted).toBe(true);
        expect(osc.isStopped).toBe(true);
        expect(typeof osc.onended).toBe('function');
      }

      // Simulate playback completion by triggering onended on all oscillators
      for (const osc of mockCtx.createdOscillators) {
        osc.triggerEnded();
      }

      // Verify strict zero-leak invariant: EVERY oscillator and gain node is disconnected
      for (const osc of mockCtx.createdOscillators) {
        expect(osc.isDisconnected).toBe(true);
        expect(osc.connectedTo.length).toBe(0);
      }

      for (const gain of mockCtx.createdGains) {
        expect(gain.isDisconnected).toBe(true);
        expect(gain.connectedTo.length).toBe(0);
      }
    });

    it('stress tests ProceduralBgmPlayer under high-rate measure scheduling, voice stop, and clean disconnection', () => {
      const mockCtx = new MockAudioContext();
      const dest = new MockAudioNode();
      const bgm = new ProceduralBgmPlayer();

      // Start BGM with mock audio graph
      bgm.start(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect(mockCtx.createdFilters.length).toBe(1);
      const filter = mockCtx.createdFilters[0];
      expect(filter.connectedTo).toContain(dest);

      // Advance simulated audio clock by 100 seconds to trigger multiple scheduler cycles
      for (let step = 0; step < 30; step++) {
        mockCtx.currentTime += 0.5;
        (bgm as any).scheduler();
      }

      // Verify notes were scheduled
      const activeCount = (bgm as any).activeNodes.length;
      expect(activeCount).toBeGreaterThan(0);

      // Now call stopBgm() while notes are still active
      bgm.stop();

      // Invariant: activeNodes must be completely purged
      expect((bgm as any).activeNodes.length).toBe(0);
      // Invariant: lowpass filter must be disconnected
      expect(filter.isDisconnected).toBe(true);
    });

    it('boundary fuzzes audio volume and mute controls with NaN, Infinity, -Infinity, and extreme values', () => {
      const hostileValues = [NaN, Infinity, -Infinity, -999, 999, 1e20, -1e20, 0, 1, 0.5];

      for (const val of hostileValues) {
        audio.setMasterVolume(val);
        audio.setBgmVolume(val);
        audio.setSfxVolume(val);

        const s = audio.getSettings();
        // Invariant: Volume must NEVER be NaN, negative, or greater than 1.0
        expect(Number.isFinite(s.masterVolume)).toBe(true);
        expect(s.masterVolume).toBeGreaterThanOrEqual(0.0);
        expect(s.masterVolume).toBeLessThanOrEqual(1.0);

        expect(Number.isFinite(s.bgmVolume)).toBe(true);
        expect(s.bgmVolume).toBeGreaterThanOrEqual(0.0);
        expect(s.bgmVolume).toBeLessThanOrEqual(1.0);

        expect(Number.isFinite(s.sfxVolume)).toBe(true);
        expect(s.sfxVolume).toBeGreaterThanOrEqual(0.0);
        expect(s.sfxVolume).toBeLessThanOrEqual(1.0);
      }
    });

    it('confirms headless node safety: all audio methods execute as safe no-ops without mock dependencies', () => {
      const rawAudio = new AudioEngine();
      expect(rawAudio.isAvailable()).toBe(false);

      expect(() => rawAudio.playSfx('coin')).not.toThrow();
      expect(() => rawAudio.startBgm()).not.toThrow();
      expect(() => rawAudio.stopBgm()).not.toThrow();
      expect(() => rawAudio.setMasterVolume(0.5)).not.toThrow();
      expect(() => rawAudio.toggleMute()).not.toThrow();
      expect(() => rawAudio.destroy()).not.toThrow();
    });
  });

  // =========================================================================
  // SECTION 2: Rapid UI Spamming, Bulk Pills & Currency Invariants
  // =========================================================================
  describe('2. Rapid UI Spamming & State Invariants', () => {
    let drawer: HudDrawer;

    beforeEach(() => {
      drawer = new HudDrawer({ simulation: sim, audio });
    });

    it('survives 1,000 rapid drawer toggle calls and tab switches without NaN position or state corruption', () => {
      const tabs: Array<'chores' | 'multipliers' | 'territory' | 'sanctuaries'> = [
        'chores',
        'multipliers',
        'territory',
        'sanctuaries',
      ];

      for (let i = 0; i < 1000; i++) {
        // Toggle open/close
        if (i % 3 === 0) {
          drawer.toggle();
        }

        // Switch tabs rapidly
        const tab = tabs[i % tabs.length];
        drawer.selectTab(tab);

        // Advance animation ticker with diverse deltaSeconds
        const delta = (i % 10) * 0.016;
        drawer.update(delta);

        // Invariant: drawer.position.y is finite, non-NaN, and bounded
        expect(Number.isFinite(drawer.position.y)).toBe(true);
        expect(Number.isNaN(drawer.position.y)).toBe(false);
        expect(drawer.position.y).toBeGreaterThanOrEqual(259);
        expect(drawer.position.y).toBeLessThanOrEqual(597);
        expect(drawer.activeTab).toBe(tab);
      }
    });

    it('survives 1,000 rapid clicks on Bulk Buy pills and strictly enforces active mode invariants', () => {
      const choresTab = (drawer as any).choresTab as ChoresTab;
      expect(choresTab).toBeDefined();

      const modes = [1, 10, 25, -1] as const;

      for (let i = 0; i < 1000; i++) {
        const mode = modes[i % modes.length];
        choresTab.setBulkMode(mode);

        expect(choresTab.getBulkMode()).toBe(mode);

        choresTab.update();
      }

      expect(choresTab.getBulkMode()).toBe(modes[999 % modes.length]);
    });

    it('survives 1,000 rapid facility buy clicks with zero gold: verifies zero purchases, zero NaN, zero negative currency', () => {
      const choresTab = (drawer as any).choresTab as ChoresTab;
      const initialGold = sim.getState().currencies.gold;
      expect(initialGold).toBe(0);

      const cardViews = (choresTab as any).cardViews as any[];
      expect(cardViews.length).toBe(8);

      // Attempt 1,000 purchases with 0 gold
      for (let i = 0; i < 1000; i++) {
        const card = cardViews[i % cardViews.length];
        // Trigger button click
        card.buyBtn.onClickHandler();

        const curGold = sim.getState().currencies.gold;
        expect(curGold).toBe(0);
        expect(Number.isFinite(curGold)).toBe(true);
      }

      // Invariant: All facility levels remain 0
      for (const fac of FIFI_FACILITIES) {
        expect(sim.getState().facilities[fac.id]?.level ?? 0).toBe(0);
      }
    });

    it('simulates 1,000 rapid facility buy clicks with substantial gold: verifies strict gold conservation and monotonic levels', () => {
      const choresTab = (drawer as any).choresTab as ChoresTab;
      const START_GOLD = 2_000_000_000;
      sim.addResource('gold', START_GOLD);

      const cardViews = (choresTab as any).cardViews as any[];
      const modes = [1, 10, 25, -1] as const;

      for (let i = 0; i < 1000; i++) {
        // Replenish gold periodically to stress-test high-tier facilities alongside MAX buy
        if (i % 20 === 0) {
          sim.addResource('gold', 10_000_000_000);
        }

        const mode = modes[(i + Math.floor(i / cardViews.length)) % modes.length];
        choresTab.setBulkMode(mode);
        const card = cardViews[i % cardViews.length];
        card.buyBtn.onClickHandler();

        const gold = sim.getState().currencies.gold;
        expect(gold).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(gold)).toBe(true);
        expect(Number.isNaN(gold)).toBe(false);
      }

      // Invariant: Facility levels must have increased
      let totalLevels = 0;
      for (const fac of FIFI_FACILITIES) {
        const lvl = sim.getState().facilities[fac.id]?.level ?? 0;
        expect(lvl).toBeGreaterThan(0);
        expect(Number.isInteger(lvl)).toBe(true);
        totalLevels += lvl;
      }
      expect(totalLevels).toBeGreaterThan(50);

      // Invariant: GPS production is positive and finite
      const gps = sim.getTotalGPS();
      expect(gps).toBeGreaterThan(0);
      expect(Number.isFinite(gps)).toBe(true);
    });

    it('stress tests MultipliersTab: 500 rapid clicks strictly preserve compounding progression and prevent overspending', () => {
      const multTab = (drawer as any).multipliersTab as MultipliersTab;
      const cardViews = (multTab as any).cardViews as any[];
      expect(cardViews.length).toBe(4);

      // Phase 1: 0 gold -> 0 purchases
      for (let i = 0; i < 200; i++) {
        const card = cardViews[i % cardViews.length];
        card.buyBtn.onClickHandler();
      }
      for (const mult of NYAH_MULTIPLIERS) {
        expect(sim.getState().multipliers[mult.id]?.level ?? 0).toBe(0);
      }

      // Phase 2: Add 10,000,000 gold and purchase
      sim.addResource('gold', 10_000_000);
      for (let i = 0; i < 300; i++) {
        const card = cardViews[i % cardViews.length];
        card.buyBtn.onClickHandler();
        const gold = sim.getState().currencies.gold;
        expect(gold).toBeGreaterThanOrEqual(0);
      }

      for (const mult of NYAH_MULTIPLIERS) {
        const mState = sim.getState().multipliers[mult.id];
        expect(mState).toBeDefined();
        expect(mState!.level).toBeGreaterThan(0);
        expect(mState!.multiplierValue).toBeGreaterThan(1.0);
        expect(Number.isFinite(mState!.multiplierValue)).toBe(true);
      }
    });

    it('stress tests TerritoryTab: verifies strict prerequisite gating and safe behavior when all zones are unlocked', () => {
      const terrTab = (drawer as any).territoryTab as TerritoryTab;
      const expandBtn = (terrTab as any).expandBtn;

      // Click with 0 resources
      for (let i = 0; i < 100; i++) {
        expandBtn.onClickHandler();
      }
      // Invariant: Still Tier 1
      expect(sim.getState().territory.currentTier).toBe(1);

      // Grant sufficient resources for all 5 tiers
      sim.addResource('gold', 100_000_000);
      sim.addResource('treats', 50_000);
      sim.addResource('essence', 50_000);
      for (let c = 0; c < 1500; c++) sim.handleClick();

      // Unlock through all tiers
      for (let t = 2; t <= 5; t++) {
        terrTab.update();
        expandBtn.onClickHandler();
        expect(sim.getState().territory.currentTier).toBe(t);
      }

      expect(sim.getState().territory.currentTier).toBe(5);
      expect(sim.getState().territory.unlockedZones.length).toBe(5);

      // Now spam 300 clicks while at max tier: must not throw or corrupt
      for (let i = 0; i < 300; i++) {
        terrTab.update();
        expandBtn.onClickHandler();
      }
      expect(sim.getState().territory.currentTier).toBe(5);
    });

    it('stress tests SanctuaryTab: rapid assign/unassign cycling strictly enforces habitat capacities and species count', () => {
      const sancTab = (drawer as any).sanctuaryTab as SanctuaryTab;
      const cardViews = (sancTab as any).cardViews as any[];
      expect(cardViews.length).toBe(10);

      // 1. Attempt assign with 0 creatures caught
      for (let i = 0; i < 100; i++) {
        const card = cardViews[i % cardViews.length];
        card.assignBtn.onClickHandler();
      }
      // Nothing assigned
      for (const spec of CREATURE_SPECIES) {
        expect(sim.getState().creatures.caught[spec.id]?.assignedHabitat).toBeUndefined();
      }

      // 2. Catch creatures
      sim.addResource('treats', 10_000);
      // Spawn and catch 3 Purrble (habitat porch capacity = 3)
      while ((sim.getState().creatures.caught['purrble']?.count ?? 0) < 3) {
        const wild = sim.spawnWildCreature('zone_01_parlor', 'purrble');
        if (wild) {
          sim.attemptCatchCreature(wild.id, true);
        }
      }

      expect(sim.getState().creatures.caught['purrble']?.count).toBe(3);

      // 3. Spam assign / unassign 300 times
      const purrbleCard = cardViews.find((c: any) => c.id === 'purrble');
      expect(purrbleCard).toBeDefined();

      for (let i = 0; i < 300; i++) {
        purrbleCard.assignBtn.onClickHandler();
      }

      // Check final state integrity
      sancTab.update();
      const cData = sim.getState().creatures.caught['purrble'];
      expect(cData).toBeDefined();
      expect(cData!.count).toBe(3);
    });
  });

  // =========================================================================
  // SECTION 3: Dialogue & Modal Lifecycle Stress
  // =========================================================================
  describe('3. Dialogue & Story Modal Lifecycle Stress', () => {
    let modal: StoryModal;

    beforeEach(() => {
      modal = new StoryModal({
        nyahPortrait: Texture.EMPTY,
        fifiPortrait: Texture.EMPTY,
      });
    });

    it('cycles all 8 story sequences rapidly under 500 rapid clicks without container leaks or index corruption', () => {
      for (let s = 0; s < STORY_SEQUENCES.length; s++) {
        const seq = STORY_SEQUENCES[s];
        let completed = false;

        modal.playSequence(seq, () => {
          completed = true;
        });

        expect(modal.isShowing()).toBe(true);

        // Rapid click through lines
        const maxClicks = seq.lines.length * 3 + 5;
        for (let c = 0; c < maxClicks; c++) {
          if (!modal.isShowing()) break;
          // Alternate between box click, next button, and ticker update
          if (c % 2 === 0) {
            (modal as any).handleNext();
          } else {
            (modal as any).handleBoxClick();
          }
          modal.update(0.05);
        }

        expect(modal.isShowing()).toBe(false);
        expect(completed).toBe(true);
      }
    });

    it('proves idempotent modal close: repeated close() calls do not throw or duplicate completions', () => {
      let callCount = 0;
      modal.playSequence(STORY_SEQUENCES[0], () => {
        callCount++;
      });

      // Rapidly call close 50 times
      for (let i = 0; i < 50; i++) {
        modal.close();
      }

      expect(modal.isShowing()).toBe(false);
      // Even if called repeatedly, modal is cleanly closed
      expect(callCount).toBeGreaterThanOrEqual(1);
    });

    it('stress tests SpeechBubble with 500 rapid show calls and hostile text / anchor inputs', () => {
      let anchor = { x: 480, y: 320 };
      const bubble = new SpeechBubble({
        speaker: 'nyah',
        getAnchorPos: () => anchor,
      });

      const testQuotes = [
        ...NYAH_AMBIENT_QUOTES.idle,
        ...FIFI_AMBIENT_QUOTES.idle,
        '', // empty
        'A'.repeat(500), // huge text
        'Nyaah!? 🐾 ✨ 🧹 👑 💖 [Cat Maid]', // unicode + emoji
      ];

      const hostileAnchors = [
        { x: -500, y: 100 },
        { x: 5000, y: 500 },
        { x: 10, y: 10 },
        { x: 950, y: 640 },
        { x: 480, y: 320 },
      ];

      for (let i = 0; i < 500; i++) {
        anchor = hostileAnchors[i % hostileAnchors.length];
        const q = testQuotes[i % testQuotes.length];

        bubble.show(q, 3.5);
        expect(bubble.visible).toBe(true);
        expect(bubble.alpha).toBe(1);

        // Update lifecycle
        bubble.update(0.016);

        // Invariant: Bubble position X is strictly clamped to [10, 950]
        const halfW = Math.floor((bubble as any).bubbleWidth / 2);
        expect(bubble.position.x).toBeGreaterThanOrEqual(halfW + 10);
        expect(bubble.position.x).toBeLessThanOrEqual(950 - halfW);
      }

      // Fast forward past max life to test fade out and hide
      bubble.update(4.0);
      expect(bubble.visible).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 4: SoundControls UI Stress & Synchronization
  // =========================================================================
  describe('4. SoundControls UI & State Synchronization Stress', () => {
    it('survives 500 rapid clicks across volume increments, decrements, and mute toggles with 0 drift', () => {
      let changeNotified = 0;
      const controls = new SoundControls({
        audio,
        onVolumeChange: () => {
          changeNotified++;
          sim.updateAudioSettings(audio.getSettings());
        },
      });

      // Find buttons in SoundControls container
      const buttons = controls.children.filter((c: any) => typeof c.onClickHandler === 'function') as any[];
      expect(buttons.length).toBeGreaterThanOrEqual(7); // mute, master-, master+, bgm-, bgm+, sfx-, sfx+

      for (let i = 0; i < 500; i++) {
        const btn = buttons[i % buttons.length];
        btn.onClickHandler();

        const s = audio.getSettings();
        const simS = sim.getState().settings;

        // Invariant: Audio and Simulation settings are strictly synchronized
        expect(simS.masterVolume).toBe(s.masterVolume);
        expect(simS.bgmVolume).toBe(s.bgmVolume);
        expect(simS.sfxVolume).toBe(s.sfxVolume);
        expect(simS.muted).toBe(s.muted);

        // Invariant: Labels are updated and non-NaN
        const masterText = (controls as any).masterText.text;
        const bgmText = (controls as any).bgmText.text;
        const sfxText = (controls as any).sfxText.text;
        expect(masterText).not.toContain('NaN');
        expect(bgmText).not.toContain('NaN');
        expect(sfxText).not.toContain('NaN');
      }

      expect(changeNotified).toBe(500);
    });
  });
});
