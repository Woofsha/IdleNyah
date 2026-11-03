// tests/stress/m5_empirical_challenger.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

// Polyfills for headless Node.js environment
class MockCanvasRenderingContext2D {
  measureText(text: string) {
    return { width: text.length * 8, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 };
  }
  font = '';
  fillText() {}
  fillRect() {}
  clearRect() {}
  getImageData() { return { data: [] }; }
  putImageData() {}
}

if (typeof (globalThis as any).CanvasRenderingContext2D === 'undefined') {
  (globalThis as any).CanvasRenderingContext2D = MockCanvasRenderingContext2D;
}

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: () => new MockCanvasRenderingContext2D(),
          width: 200,
          height: 100,
          style: {},
        };
      }
      return {};
    },
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

import { GameSimulation } from '../../src/core/simulation';
import { calculateBulkCost, calculateMaxAffordable, calculateSingleCost } from '../../src/core/math';
import { FIFI_FACILITIES } from '../../src/core/facilities';
import { NYAH_MULTIPLIERS } from '../../src/core/multipliers';
import { TERRITORY_ZONES, checkZoneUnlockPrerequisites } from '../../src/core/territory';
import { CREATURE_SPECIES, HABITATS } from '../../src/core/creatures';
import { AudioEngine } from '../../src/audio/engine';
import { playProceduralSfx } from '../../src/audio/sfx';
import type { SfxType } from '../../src/audio/types';
import { SpeechBubble } from '../../src/ui/speechBubble';
import { HudDrawer } from '../../src/ui/drawer';
import {
  STORY_SEQUENCES,
  NYAH_AMBIENT_QUOTES,
  FIFI_AMBIENT_QUOTES,
  getNextPendingMilestone,
} from '../../src/ui/dialogueData';

describe('Milestone 5 Empirical Challenger Stress & Verification Suite', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = new GameSimulation({ seed: 1337 });
  });

  describe('1. UI Drawer State Synchronization & Bulk Buy Mathematics', () => {
    it('verifies 1x, 10x, 25x, and MAX bulk buy cost calculations match closed-form formulas', () => {
      sim.addResource('gold', 1_000_000_000);

      for (const fac of FIFI_FACILITIES) {
        const curLevel = sim.getState().facilities[fac.id].level;

        // 1x
        const cost1 = sim.getUpgradeCost(fac.id, 1);
        const expected1 = calculateBulkCost(fac.baseCost, fac.costRatio, curLevel, 1);
        expect(cost1).toBeCloseTo(expected1, 4);

        // 10x
        const cost10 = sim.getUpgradeCost(fac.id, 10);
        const expected10 = calculateBulkCost(fac.baseCost, fac.costRatio, curLevel, 10);
        expect(cost10).toBeCloseTo(expected10, 4);

        // 25x
        const cost25 = sim.getUpgradeCost(fac.id, 25);
        const expected25 = calculateBulkCost(fac.baseCost, fac.costRatio, curLevel, 25);
        expect(cost25).toBeCloseTo(expected25, 4);

        // MAX mode
        const gold = sim.getState().currencies.gold;
        const maxAfford = calculateMaxAffordable(gold, fac.baseCost, fac.costRatio, curLevel);
        expect(maxAfford.count).toBeGreaterThan(0);
        expect(maxAfford.cost).toBeLessThanOrEqual(gold);
      }
    });

    it('verifies purchasing facilities in bulk deducts gold and increments level accurately', () => {
      const fac = FIFI_FACILITIES[0]; // fifi_broom
      const initialGold = 5000;
      sim.addResource('gold', initialGold);

      const cost10 = sim.getUpgradeCost(fac.id, 10);
      const success = sim.buyFacility(fac.id, 10);
      expect(success).toBe(true);

      const state = sim.getState();
      expect(state.facilities[fac.id].level).toBe(10);
      expect(state.currencies.gold).toBeCloseTo(initialGold - cost10, 4);

      // Verify MAX mode buy
      const currentGold = state.currencies.gold;
      const maxInfo = calculateMaxAffordable(currentGold, fac.baseCost, fac.costRatio, 10);
      const buyMaxSuccess = sim.buyFacility(fac.id, -1);
      expect(buyMaxSuccess).toBe(true);

      const afterMaxState = sim.getState();
      expect(afterMaxState.facilities[fac.id].level).toBe(10 + maxInfo.count);
      expect(afterMaxState.currencies.gold).toBeCloseTo(currentGold - maxInfo.cost, 4);
    });

    it('verifies purchasing Nyah multipliers updates state, deducts gold, and boosts GPS', () => {
      // First give base production
      sim.addResource('gold', 100_000);
      sim.buyFacility('fifi_broom', 10);
      const baseGps = sim.getTotalGPS();
      expect(baseGps).toBeGreaterThan(0);

      // Purchase nyah_supervision (fifi_boost category, +10% per level)
      const mult = NYAH_MULTIPLIERS.find((m) => m.id === 'nyah_supervision')!;
      const cost = calculateSingleCost(mult.baseCost, mult.costRatio, 0);

      const preGold = sim.getState().currencies.gold;
      const success = sim.buyMultiplier(mult.id);
      expect(success).toBe(true);

      const state = sim.getState();
      expect(state.multipliers[mult.id].level).toBe(1);
      expect(state.currencies.gold).toBeCloseTo(preGold - cost, 4);

      // Total GPS must now be multiplied by (1.0 + 0.10) = 1.10x
      const newGps = sim.getTotalGPS();
      expect(newGps).toBeCloseTo(baseGps * 1.10, 4);
    });

    it('verifies territory expansion prerequisite checks, zone progression, and multipliers', () => {
      const state = sim.getState();
      expect(state.territory.currentTier).toBe(1);
      expect(state.territory.unlockedZones).toEqual(['zone_01_parlor']);

      const nextZone = TERRITORY_ZONES[1]; // zone_02_kitchen_garden
      expect(nextZone.tier).toBe(2);

      // Without required resources, prerequisite check fails
      const checkFail = checkZoneUnlockPrerequisites(
        nextZone,
        state.territory.unlockedZones,
        state.clickStats.totalClicks,
        state.currencies
      );
      expect(checkFail.canUnlock).toBe(false);
      expect(sim.unlockTerritory(nextZone.id)).toBe(false);

      // Fulfill requirements
      sim.addResource('gold', nextZone.costGold);
      if (nextZone.costTreats > 0) sim.addResource('treats', nextZone.costTreats);
      if (nextZone.costEssence > 0) sim.addResource('essence', nextZone.costEssence);
      for (let i = 0; i < (nextZone.prerequisiteChores ?? 0); i++) {
        sim.handleClick();
      }

      const checkPass = checkZoneUnlockPrerequisites(
        nextZone,
        sim.getState().territory.unlockedZones,
        sim.getState().clickStats.totalClicks,
        sim.getState().currencies
      );
      expect(checkPass.canUnlock).toBe(true);

      const unlockSuccess = sim.unlockTerritory(nextZone.id);
      expect(unlockSuccess).toBe(true);
      expect(sim.getState().territory.currentTier).toBe(2);
      expect(sim.getState().territory.unlockedZones).toContain(nextZone.id);
    });

    it('empirically tests creature assignment and unassignment behavior in simulation', () => {
      // Catch a creature directly into caught state
      const spec = CREATURE_SPECIES[0]; // purrble (preferred: habitat_porch)
      sim.getState().creatures.caught[spec.id] = {
        count: 1,
        level: 1,
        assignedHabitat: spec.preferredHabitatId,
        xp: 0,
        isShiny: false,
      };

      expect(sim.getState().creatures.caught[spec.id].assignedHabitat).toBe('habitat_porch');

      // Test reassigning to another unlocked habitat if valid
      // In tier 1, only habitat_porch (zone_01_parlor) is unlocked.
      // Trying to assign to locked habitat_garden should fail:
      const assignLocked = sim.assignCreature(spec.id, 'habitat_garden');
      expect(assignLocked).toBe(false);
      expect(sim.getState().creatures.caught[spec.id].assignedHabitat).toBe('habitat_porch');

      // Now check unassigning: what happens if habitatId is empty string?
      const unassignResult = sim.assignCreature(spec.id, '');
      // Empirical verification: unassignment succeeds, returning true and clearing assignedHabitat
      expect(unassignResult).toBe(true);
      expect(sim.getState().creatures.caught[spec.id].assignedHabitat).toBeUndefined();
    });

    it('enforces habitat capacity limits across multiple creatures', () => {
      const porch = HABITATS.find((h) => h.id === 'habitat_porch')!;
      expect(porch.capacity).toBe(3);

      // Assign 3 barklings
      sim.getState().creatures.caught['barkling'] = {
        count: 3,
        level: 1,
        assignedHabitat: 'habitat_porch',
        xp: 0,
        isShiny: false,
      };

      // Now try to assign purrble to habitat_porch: capacity is 3, currently 3 assigned
      sim.getState().creatures.caught['purrble'] = {
        count: 1,
        level: 1,
        assignedHabitat: undefined,
        xp: 0,
        isShiny: false,
      };

      const overCapacityAssign = sim.assignCreature('purrble', 'habitat_porch');
      expect(overCapacityAssign).toBe(false);
    });

    it('empirically audits HudDrawer dock header layout and detects geometric collisions', () => {
      const audio = new AudioEngine();
      const drawer = new HudDrawer({ simulation: sim, audio });

      // Inspect SoundControls and ToggleBtn positions
      const soundControls: any = (drawer as any).soundControls;
      const toggleBtn: any = (drawer as any).toggleBtn;

      expect(soundControls).toBeDefined();
      expect(toggleBtn).toBeDefined();

      const scGlobalX = soundControls.position.x; // 500
      const scGlobalY = soundControls.position.y; // 10
      const sfxPlusBtn = soundControls.children.find(
        (c: any) => c.btnText === '+' && c.position.x > 300
      );
      expect(sfxPlusBtn).toBeDefined();

      const sfxPlusGlobalX = scGlobalX + sfxPlusBtn.position.x; // 500 + 364 = 864
      const sfxPlusGlobalY = scGlobalY + sfxPlusBtn.position.y; // 10 + 0 = 10
      const sfxPlusWidth = sfxPlusBtn.btnWidth ?? 18;
      const sfxPlusHeight = sfxPlusBtn.btnHeight ?? 24;

      const toggleX = toggleBtn.position.x; // 896
      const toggleY = toggleBtn.position.y; // 6
      const toggleWidth = toggleBtn.btnWidth ?? 34;
      const toggleHeight = toggleBtn.btnHeight ?? 32;

      // Check collision between toggleBtn [toggleX, toggleX + toggleWidth] and sfxPlusBtn [sfxPlusGlobalX, sfxPlusGlobalX + sfxPlusWidth]
      const overlapsX = toggleX < sfxPlusGlobalX + sfxPlusWidth && toggleX + toggleWidth > sfxPlusGlobalX;
      const overlapsY = toggleY < sfxPlusGlobalY + sfxPlusHeight && toggleY + toggleHeight > sfxPlusGlobalY;

      console.log(`[COLLISION AUDIT] toggleBtn: [x=${toggleX}..${toggleX + toggleWidth}, y=${toggleY}..${toggleY + toggleHeight}], sfxPlus: [x=${sfxPlusGlobalX}..${sfxPlusGlobalX + sfxPlusWidth}, y=${sfxPlusGlobalY}..${sfxPlusGlobalY + sfxPlusHeight}], overlaps=${overlapsX && overlapsY}`);

      // We assert that there is NO overlap and at least 10px clear gutter
      expect(overlapsX && overlapsY).toBe(false);
      expect(toggleX - (sfxPlusGlobalX + sfxPlusWidth)).toBeGreaterThanOrEqual(10);
    });
  });

  describe('2. Audio Engine Headless Safety, Mocked AudioContext & Memory Leak Disconnects', () => {
    it('AudioEngine safely handles all operations without window or AudioContext in Node.js', async () => {
      const audio = new AudioEngine();
      await audio.init();
      expect(audio.isAvailable()).toBe(false);

      // All methods must be safe no-ops
      expect(() => audio.playSfx('click')).not.toThrow();
      expect(() => audio.playSfx('coin')).not.toThrow();
      expect(() => audio.playSfx('upgrade')).not.toThrow();
      expect(() => audio.playSfx('catch')).not.toThrow();
      expect(() => audio.playSfx('fanfare')).not.toThrow();
      expect(() => audio.playSfx('frenzy')).not.toThrow();
      expect(() => audio.playSfx('petting')).not.toThrow();
      expect(() => audio.startBgm()).not.toThrow();
      expect(() => audio.stopBgm()).not.toThrow();
      expect(() => audio.destroy()).not.toThrow();
    });

    it('verifies procedural SFX oscillator and gain disconnection handlers with a mock AudioContext', () => {
      const disconnectedNodes: any[] = [];
      const scheduledStarts: number[] = [];
      const scheduledStops: number[] = [];
      const createdOscillators: any[] = [];

      // Create a lightweight Web Audio mock
      const mockGain = () => ({
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          cancelScheduledValues: () => {},
        },
        connect: () => {},
        disconnect: function () {
          disconnectedNodes.push(this);
        },
      });

      const mockOsc = () => {
        const osc: any = {
          type: 'sine',
          frequency: {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
          },
          connect: () => {},
          disconnect: function () {
            disconnectedNodes.push(this);
          },
          start: (t: number) => {
            scheduledStarts.push(t);
          },
          stop: (t: number) => {
            scheduledStops.push(t);
          },
          onended: null as (() => void) | null,
        };
        createdOscillators.push(osc);
        return osc;
      };

      const mockCtx: any = {
        currentTime: 10.0,
        createGain: mockGain,
        createOscillator: mockOsc,
      };

      const mockDest = mockGain();

      const allSfx: SfxType[] = ['click', 'coin', 'upgrade', 'catch', 'fanfare', 'frenzy', 'petting'];

      for (const sfx of allSfx) {
        disconnectedNodes.length = 0;
        scheduledStarts.length = 0;
        scheduledStops.length = 0;
        createdOscillators.length = 0;

        playProceduralSfx(mockCtx, mockDest as any, sfx);

        expect(scheduledStarts.length).toBeGreaterThan(0);
        expect(scheduledStops.length).toBe(scheduledStarts.length);

        // Every oscillator created must have registered an onended handler that disconnects itself and gain
        expect(createdOscillators.length).toBeGreaterThan(0);
        for (const osc of createdOscillators) {
          expect(typeof osc.onended).toBe('function');
          // Fire onended to test disconnection logic
          osc.onended();
        }

        // Each osc onended must have called osc.disconnect() and gain.disconnect()
        expect(disconnectedNodes.length).toBe(createdOscillators.length * 2);
      }
    });

    it('verifies volume clamping and synchronization with GameSimulation', () => {
      let notified: any = null;
      const audio = new AudioEngine({
        onSettingsChange: (s) => {
          notified = s;
          sim.updateAudioSettings(s);
        },
      });

      // Volume limits [0, 1]
      audio.setMasterVolume(1.5);
      expect(audio.getSettings().masterVolume).toBe(1.0);
      expect(sim.getState().settings.masterVolume).toBe(1.0);

      audio.setMasterVolume(-0.5);
      expect(audio.getSettings().masterVolume).toBe(0.0);
      expect(sim.getState().settings.masterVolume).toBe(0.0);

      audio.setBgmVolume(0.42);
      expect(sim.getState().settings.bgmVolume).toBe(0.42);

      audio.setSfxVolume(0.88);
      expect(sim.getState().settings.sfxVolume).toBe(0.88);

      const muteState = audio.toggleMute();
      expect(muteState).toBe(true);
      expect(sim.getState().settings.muted).toBe(true);
    });
  });

  describe('3. Dialogue System Anchoring, Boundary Clamping & Story Milestone Tracking', () => {
    it('verifies speech bubbles clamp coordinates to screen boundaries [10, 950]', () => {
      let currentAnchor = { x: 500, y: 300 };
      const bubble = new SpeechBubble({
        speaker: 'nyah',
        getAnchorPos: () => currentAnchor,
      });

      bubble.show('Hello Master!');
      // Center position
      expect(bubble.position.x).toBe(500);

      // Extreme left: x = -100
      currentAnchor = { x: -100, y: 300 };
      bubble.update(0.016);
      expect(bubble.position.x).toBeGreaterThanOrEqual(10);

      // Extreme right: x = 1200
      currentAnchor = { x: 1200, y: 300 };
      bubble.update(0.016);
      expect(bubble.position.x).toBeLessThanOrEqual(950);

      // Extreme top: y = -50
      currentAnchor = { x: 500, y: -50 };
      bubble.update(0.016);
      expect(bubble.position.y).toBeGreaterThanOrEqual(38);
    });

    it('verifies story progression milestone sequences trigger exactly once in order', () => {
      const completed = new Set<string>();

      // Milestone 1: intro_welcome
      let next = getNextPendingMilestone(sim.getState(), completed);
      expect(next?.id).toBe('intro_welcome');
      completed.add(next!.id);

      // Once added to completed, it will NOT trigger again
      next = getNextPendingMilestone(sim.getState(), completed);
      expect(next).toBeNull();

      // Trigger first_chore_unlocked
      sim.addResource('gold', 100);
      sim.buyFacility('fifi_broom', 1);
      next = getNextPendingMilestone(sim.getState(), completed);
      expect(next?.id).toBe('first_chore_unlocked');
      completed.add(next!.id);

      expect(getNextPendingMilestone(sim.getState(), completed)).toBeNull();

      // Trigger first_frenzy_triggered
      sim.getState().clickStats.frenzyActive = true;
      next = getNextPendingMilestone(sim.getState(), completed);
      expect(next?.id).toBe('first_frenzy_triggered');
      completed.add(next!.id);

      expect(getNextPendingMilestone(sim.getState(), completed)).toBeNull();
    });

    it('verifies all story sequences and ambient quotes contain zero em dashes', () => {
      const emDashRegex = /[\u2014—]/;

      for (const seq of STORY_SEQUENCES) {
        expect(seq.title).not.toMatch(emDashRegex);
        for (const line of seq.lines) {
          expect(line.speakerName).not.toMatch(emDashRegex);
          expect(line.text).not.toMatch(emDashRegex);
        }
      }

      for (const pool of Object.values(NYAH_AMBIENT_QUOTES)) {
        for (const quote of pool) {
          expect(quote).not.toMatch(emDashRegex);
        }
      }

      for (const pool of Object.values(FIFI_AMBIENT_QUOTES)) {
        for (const quote of pool) {
          expect(quote).not.toMatch(emDashRegex);
        }
      }
    });
  });
});
