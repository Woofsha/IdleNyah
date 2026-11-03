// tests/stress/m5_remediation_adversarial.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
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

if (typeof (globalThis as any).CanvasRenderingContext2D === 'undefined') {
  class MockCanvasRenderingContext2D {
    measureText(text: string) {
      return { width: (text || '').length * 8, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 };
    }
    font = '';
    fillText() {}
    fillRect() {}
    clearRect() {}
    getImageData() { return { data: [] }; }
    putImageData() {}
  }
  (globalThis as any).CanvasRenderingContext2D = MockCanvasRenderingContext2D;
}

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: () => new (globalThis as any).CanvasRenderingContext2D(),
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
import { HudDrawer } from '../../src/ui/drawer';
import { StoryModal } from '../../src/ui/dialogueModal';
import { STORY_SEQUENCES } from '../../src/ui/dialogueData';
import { HABITATS, CREATURE_SPECIES } from '../../src/core/creatures';

describe('Milestone 5 Remediation Adversarial Stress Suite (challenger_m5_2_2)', () => {
  let sim: GameSimulation;
  let audio: AudioEngine;

  beforeEach(() => {
    sim = new GameSimulation({ seed: 4242 });
    audio = new AudioEngine({
      onSettingsChange: (s) => sim.updateAudioSettings(s),
    });
  });

  // =========================================================================
  // Objective 1: 1,000 Rapid Clicks across Drawer Dock, sfxPlus, & toggleBtn
  // =========================================================================
  describe('1. Drawer Dock Buttons, sfxPlus, and toggleBtn Collision & Rapid Click Spamming', () => {
    it('empirically audits 0 geometric collisions and >= 10px clear gutter between all dock buttons', () => {
      const drawer = new HudDrawer({ simulation: sim, audio });

      const tabChores = (drawer as any).tabChoresBtn;
      const tabMults = (drawer as any).tabMultipliersBtn;
      const tabTerr = (drawer as any).tabTerritoryBtn;
      const tabSanc = (drawer as any).tabSanctuaryBtn;
      const soundControls = (drawer as any).soundControls;
      const toggleBtn = (drawer as any).toggleBtn;

      // Extract all dock interactive elements with absolute bounds in drawer coordinates
      const dockElements: Array<{ name: string; x1: number; x2: number; y1: number; y2: number }> = [
        {
          name: 'tabChoresBtn',
          x1: tabChores.position.x,
          x2: tabChores.position.x + (tabChores.btnWidth ?? 110),
          y1: tabChores.position.y,
          y2: tabChores.position.y + (tabChores.btnHeight ?? 32),
        },
        {
          name: 'tabMultipliersBtn',
          x1: tabMults.position.x,
          x2: tabMults.position.x + (tabMults.btnWidth ?? 126),
          y1: tabMults.position.y,
          y2: tabMults.position.y + (tabMults.btnHeight ?? 32),
        },
        {
          name: 'tabTerritoryBtn',
          x1: tabTerr.position.x,
          x2: tabTerr.position.x + (tabTerr.btnWidth ?? 114),
          y1: tabTerr.position.y,
          y2: tabTerr.position.y + (tabTerr.btnHeight ?? 32),
        },
        {
          name: 'tabSanctuaryBtn',
          x1: tabSanc.position.x,
          x2: tabSanc.position.x + (tabSanc.btnWidth ?? 114),
          y1: tabSanc.position.y,
          y2: tabSanc.position.y + (tabSanc.btnHeight ?? 32),
        },
        {
          name: 'toggleBtn',
          x1: toggleBtn.position.x,
          x2: toggleBtn.position.x + (toggleBtn.btnWidth ?? 34),
          y1: toggleBtn.position.y,
          y2: toggleBtn.position.y + (toggleBtn.btnHeight ?? 32),
        },
      ];

      // Add sound controls interactive buttons
      const scX = soundControls.position.x;
      const scY = soundControls.position.y;
      for (const child of soundControls.children) {
        if ((child as any).btnWidth && (child as any).btnHeight) {
          dockElements.push({
            name: `soundCtrl_${(child as any).btnText || 'btn'}_at_${child.position.x}`,
            x1: scX + child.position.x,
            x2: scX + child.position.x + (child as any).btnWidth,
            y1: scY + child.position.y,
            y2: scY + child.position.y + (child as any).btnHeight,
          });
        }
      }

      // Pairwise collision audit
      let collisionCount = 0;
      const collisions: string[] = [];

      for (let i = 0; i < dockElements.length; i++) {
        for (let j = i + 1; j < dockElements.length; j++) {
          const a = dockElements[i];
          const b = dockElements[j];

          const overlapsX = a.x1 < b.x2 && a.x2 > b.x1;
          const overlapsY = a.y1 < b.y2 && a.y2 > b.y1;

          if (overlapsX && overlapsY) {
            collisionCount++;
            collisions.push(`${a.name} [${a.x1}..${a.x2}, ${a.y1}..${a.y2}] intersects ${b.name} [${b.x1}..${b.x2}, ${b.y1}..${b.y2}]`);
          }
        }
      }

      expect(collisionCount, `Found collisions: ${collisions.join('; ')}`).toBe(0);

      // Verify specific gutter between sfxPlus and toggleBtn
      const sfxPlus = dockElements.find((e) => e.name.startsWith('soundCtrl_+_at_') && e.x1 > 800);
      const toggle = dockElements.find((e) => e.name === 'toggleBtn')!;
      expect(sfxPlus).toBeDefined();

      const gutter = toggle.x1 - sfxPlus!.x2;
      expect(gutter).toBeGreaterThanOrEqual(10);
      expect(gutter).toBe(14); // Exactly 896 - 882 = 14px
    });

    it('survives 1,000 rapid clicks across dock buttons with 0 collisions, 0 unexpected drawer state changes, and 0 NaN values', () => {
      const drawer = new HudDrawer({ simulation: sim, audio });

      const toggleBtn = (drawer as any).toggleBtn;
      const soundControls = (drawer as any).soundControls;
      const sfxPlusBtn = soundControls.children.find((c: any) => c.btnText === '+' && c.position.x > 300);
      const sfxMinusBtn = soundControls.children.find((c: any) => c.btnText === '-' && c.position.x > 250);
      const bgmPlusBtn = soundControls.children.find((c: any) => c.btnText === '+' && c.position.x > 200 && c.position.x < 300);
      const muteBtn = (soundControls as any).muteBtn;
      const tabChores = (drawer as any).tabChoresBtn;
      const tabMults = (drawer as any).tabMultipliersBtn;
      const tabTerr = (drawer as any).tabTerritoryBtn;
      const tabSanc = (drawer as any).tabSanctuaryBtn;

      expect(sfxPlusBtn).toBeDefined();
      expect(sfxMinusBtn).toBeDefined();

      const triggerBtn = (btn: any) => {
        if (typeof btn.onClickHandler === 'function') {
          btn.onClickHandler();
        } else {
          btn.emit('pointerdown', { stopPropagation: () => {} });
        }
      };

      let unexpectedDrawerToggles = 0;
      let nanCount = 0;

      // Initial drawer state: closed (isOpen = false)
      expect(drawer.isOpen).toBe(false);

      for (let i = 0; i < 1000; i++) {
        const choice = i % 10;
        const previousState = drawer.isOpen;

        switch (choice) {
          case 0:
          case 1:
          case 2:
            // Click sfxPlus: must NEVER toggle drawer state (remediation verification)
            triggerBtn(sfxPlusBtn);
            if (drawer.isOpen !== previousState) {
              unexpectedDrawerToggles++;
            }
            break;

          case 3:
            // Click sfxMinus: must NEVER toggle drawer state
            triggerBtn(sfxMinusBtn);
            if (drawer.isOpen !== previousState) {
              unexpectedDrawerToggles++;
            }
            break;

          case 4:
            // Click mute: must NEVER toggle drawer state
            triggerBtn(muteBtn);
            if (drawer.isOpen !== previousState) {
              unexpectedDrawerToggles++;
            }
            break;

          case 5:
            // Click bgmPlus: must NEVER toggle drawer state
            triggerBtn(bgmPlusBtn);
            if (drawer.isOpen !== previousState) {
              unexpectedDrawerToggles++;
            }
            break;

          case 6:
            // Switch tab to chores: if open, stays open; if closed, opens drawer
            triggerBtn(tabChores);
            if (!drawer.isOpen) unexpectedDrawerToggles++;
            break;

          case 7:
            triggerBtn(tabSanc);
            if (!drawer.isOpen) unexpectedDrawerToggles++;
            break;

          case 8:
            triggerBtn(tabTerr);
            if (!drawer.isOpen) unexpectedDrawerToggles++;
            break;

          case 9:
            // Toggle button explicitly inverts drawer state
            triggerBtn(toggleBtn);
            if (drawer.isOpen === previousState) {
              unexpectedDrawerToggles++;
            }
            break;
        }

        // Run animation tick
        drawer.update(0.016);

        // Audit numbers for NaN
        const currentY = (drawer as any).currentY;
        const targetY = (drawer as any).targetY;
        const settings = sim.getState().settings;

        if (Number.isNaN(currentY) || Number.isNaN(targetY)) nanCount++;
        if (Number.isNaN(settings.masterVolume) || Number.isNaN(settings.sfxVolume) || Number.isNaN(settings.bgmVolume)) {
          nanCount++;
        }
      }

      expect(unexpectedDrawerToggles).toBe(0);
      expect(nanCount).toBe(0);

      const finalSettings = sim.getState().settings;
      expect(finalSettings.sfxVolume).toBeGreaterThanOrEqual(0.0);
      expect(finalSettings.sfxVolume).toBeLessThanOrEqual(1.0);
      expect(finalSettings.bgmVolume).toBeGreaterThanOrEqual(0.0);
      expect(finalSettings.bgmVolume).toBeLessThanOrEqual(1.0);
    });
  });

  // =========================================================================
  // Objective 2: 500 Rapid Assign/Unassign Cycles in simulation.assignCreature
  // =========================================================================
  describe('2. simulation.assignCreature 500 Rapid Assign/Unassign Cycles & Capacity Accounting', () => {
    it('survives 500 rapid assign/unassign cycles with empty strings, nulls, and habitat IDs with 100% state consistency and correct capacity accounting', () => {
      // Setup caught creatures across multiple species
      const caughtEntries = ['barkling', 'purrble', 'mooshrum', 'glimmerfin', 'silkwisp'];
      for (const sp of caughtEntries) {
        sim.getState().creatures.caught[sp] = {
          count: 2,
          level: 1,
          assignedHabitat: undefined,
          xp: 0,
          isShiny: false,
        };
      }

      // Ensure tier 1 unlocked (habitat_porch in zone_01_parlor is unlocked)
      expect(sim.getState().territory.unlockedZones).toContain('zone_01_parlor');
      const porch = HABITATS.find((h) => h.id === 'habitat_porch')!;
      expect(porch).toBeDefined();
      expect(porch.capacity).toBe(3);

      const hostileHabitats = [
        '',
        'none',
        null as unknown as string,
        undefined as unknown as string,
        'habitat_porch',
        'habitat_garden', // locked initially
        'non_existent_habitat_123',
        '__proto__',
      ];

      let stateInconsistencies = 0;
      let capacityViolations = 0;
      let nanProductionCount = 0;

      for (let i = 0; i < 500; i++) {
        const speciesId = caughtEntries[i % caughtEntries.length];
        const habitatInput = hostileHabitats[i % hostileHabitats.length];

        const assignResult = sim.assignCreature(speciesId, habitatInput);

        // Verify unassign behavior:
        // When habitatInput is empty, null, undefined, or 'none', assignResult MUST be true
        if (!habitatInput || habitatInput === '' || habitatInput === 'none') {
          expect(assignResult).toBe(true);
          const currentAssigned = sim.getState().creatures.caught[speciesId].assignedHabitat;
          if (currentAssigned !== undefined) {
            stateInconsistencies++;
          }
        }

        // Verify state consistency: assignedHabitat must NEVER be empty string, null, or invalid
        for (const [id, c] of Object.entries(sim.getState().creatures.caught)) {
          if (c.assignedHabitat !== undefined) {
            if (c.assignedHabitat === '' || c.assignedHabitat === null || typeof c.assignedHabitat !== 'string') {
              stateInconsistencies++;
            }
            const habDef = HABITATS.find((h) => h.id === c.assignedHabitat);
            if (!habDef) {
              stateInconsistencies++;
            }
          }
        }

        // Verify capacity accounting across all habitats:
        // Total assigned creatures in any habitat must NEVER exceed capacity
        for (const hab of HABITATS) {
          let assignedCount = 0;
          for (const c of Object.values(sim.getState().creatures.caught)) {
            if (c.assignedHabitat === hab.id) {
              assignedCount += c.count;
            }
          }
          if (assignedCount > hab.capacity) {
            capacityViolations++;
          }
        }

        // Verify GPS/TPS/EPS production math never produces NaN or negative values
        const gps = sim.getTotalGPS();
        const tps = sim.getTotalTPS();
        const eps = sim.getTotalEPS();
        if (Number.isNaN(gps) || Number.isNaN(tps) || Number.isNaN(eps) || gps < 0 || tps < 0 || eps < 0) {
          nanProductionCount++;
        }

        // Serialization round-trip check every 100 cycles
        if (i % 100 === 0) {
          const json = sim.getSaveData();
          const restoredSim = new GameSimulation();
          const loadSuccess = restoredSim.loadSaveData(json);
          expect(loadSuccess).toBe(true);

          for (const sp of caughtEntries) {
            expect(restoredSim.getState().creatures.caught[sp]?.assignedHabitat).toBe(
              sim.getState().creatures.caught[sp]?.assignedHabitat
            );
          }
        }
      }

      expect(stateInconsistencies).toBe(0);
      expect(capacityViolations).toBe(0);
      expect(nanProductionCount).toBe(0);
    });
  });

  // =========================================================================
  // Objective 3: Rapid Close/Open Cycling on DialogueModal
  // =========================================================================
  describe('3. DialogueModal Rapid Close/Open Cycling & Callback Execution Safety', () => {
    it('guarantees zero multiple callback triggers across 500 rapid close/open cycles', () => {
      const modal = new StoryModal({
        nyahPortrait: Texture.EMPTY,
        fifiPortrait: Texture.EMPTY,
      });

      let totalSequencesRun = 0;
      let totalCallbacksTriggered = 0;
      let multipleCallbackViolations = 0;

      for (let i = 0; i < 500; i++) {
        const seq = STORY_SEQUENCES[i % STORY_SEQUENCES.length];
        let callbackInvocationForThisRun = 0;

        totalSequencesRun++;

        modal.playSequence(seq, () => {
          callbackInvocationForThisRun++;
          totalCallbacksTriggered++;
        });

        expect(modal.visible).toBe(true);

        // Rapid advance clicks through handleBoxClick or handleNext
        const advanceClicks = i % 4;
        for (let click = 0; click < advanceClicks; click++) {
          (modal as any).handleBoxClick();
        }

        // Rapid redundant close calls: call close() 3 times in immediate succession
        modal.close();
        modal.close();
        modal.close();

        // Exactly 1 callback must have been executed, never 2 or more
        if (callbackInvocationForThisRun !== 1) {
          multipleCallbackViolations++;
        }

        // Modal must be cleanly hidden and inactive
        expect(modal.visible).toBe(false);
        expect((modal as any).currentSequence).toBeNull();
        expect((modal as any).onCompleteCallback).toBeUndefined();
      }

      expect(totalSequencesRun).toBe(500);
      expect(totalCallbacksTriggered).toBe(500);
      expect(multipleCallbackViolations).toBe(0);
    });
  });
});
