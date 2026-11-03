// tests/unit/m5_ui_audio.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Texture } from 'pixi.js';
import { AudioEngine, getAudioEngine } from '../../src/audio/engine';
import type { SfxType } from '../../src/audio/types';
import { GameSimulation } from '../../src/core/simulation';
import {
  NYAH_AMBIENT_QUOTES,
  FIFI_AMBIENT_QUOTES,
  STORY_SEQUENCES,
  getNextPendingMilestone,
} from '../../src/ui/dialogueData';
import { StoryModal } from '../../src/ui/dialogueModal';
import { HudDrawer } from '../../src/ui/drawer';

// Polyfill minimal 2D canvas context for PixiJS v8 Text metrics in headless Node
if (typeof (globalThis as any).CanvasRenderingContext2D === 'undefined') {
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

if (typeof (globalThis as any).HTMLCanvasElement === 'undefined') {
  (globalThis as any).HTMLCanvasElement = class HTMLCanvasElement {};
}

if (typeof (globalThis as any).document === 'undefined') {
  const ctx = new (globalThis as any).CanvasRenderingContext2D();
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: () => ctx,
          width: 960,
          height: 640,
          style: {},
        };
      }
      return { style: {} };
    },
  };
}

describe('Milestone 5: Audio Engine & UI Verification Suite', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = new GameSimulation({ seed: 42 });
  });

  describe('1. AudioEngine Headless Safety & Lifecycle', () => {
    it('instantiates cleanly without throwing ReferenceError in headless Node.js', async () => {
      expect(typeof window).toBe('undefined');
      const audio = new AudioEngine();
      expect(audio).toBeDefined();
      await expect(audio.init()).resolves.toBeUndefined();
      expect(audio.isAvailable()).toBe(false); // Graceful headless fallback
    });

    it('manages singleton instance via getAudioEngine', () => {
      const audio1 = getAudioEngine();
      const audio2 = getAudioEngine();
      expect(audio1).toBe(audio2);
    });

    it('safely handles playSfx calls in headless mode without crashing', () => {
      const audio = new AudioEngine();
      const sfxTypes: SfxType[] = ['click', 'coin', 'upgrade', 'catch', 'fanfare', 'frenzy', 'petting'];
      sfxTypes.forEach((t) => {
        expect(() => audio.playSfx(t)).not.toThrow();
      });
    });

    it('safely handles startBgm and stopBgm calls in headless mode without crashing', () => {
      const audio = new AudioEngine();
      expect(() => audio.startBgm()).not.toThrow();
      expect(() => audio.stopBgm()).not.toThrow();
      expect(() => audio.destroy()).not.toThrow();
    });
  });

  describe('2. Volume Controls, Mute & Simulation Synchronization', () => {
    it('adjusts master, bgm, and sfx volumes with clamping to [0.0, 1.0]', () => {
      const audio = new AudioEngine();

      audio.setMasterVolume(0.5);
      expect(audio.getSettings().masterVolume).toBe(0.5);

      audio.setMasterVolume(1.8);
      expect(audio.getSettings().masterVolume).toBe(1.0);

      audio.setMasterVolume(-0.4);
      expect(audio.getSettings().masterVolume).toBe(0.0);

      audio.setBgmVolume(0.7);
      expect(audio.getSettings().bgmVolume).toBe(0.7);

      audio.setSfxVolume(0.4);
      expect(audio.getSettings().sfxVolume).toBe(0.4);
    });

    it('toggles and persists mute state cleanly', () => {
      const audio = new AudioEngine({ muted: false });
      expect(audio.getSettings().muted).toBe(false);

      const isMuted = audio.toggleMute();
      expect(isMuted).toBe(true);
      expect(audio.getSettings().muted).toBe(true);

      audio.setMuted(false);
      expect(audio.getSettings().muted).toBe(false);
    });

    it('triggers onSettingsChange callback to synchronize with GameSimulation', () => {
      let notifiedSettings: any = null;
      const audio = new AudioEngine({
        onSettingsChange: (s) => {
          notifiedSettings = s;
          sim.updateAudioSettings(s);
        },
      });

      audio.setMasterVolume(0.65);
      expect(notifiedSettings).toBeDefined();
      expect(notifiedSettings.masterVolume).toBe(0.65);
      expect(sim.getState().settings.masterVolume).toBe(0.65);

      audio.toggleMute();
      expect(sim.getState().settings.muted).toBe(true);
    });
  });

  describe('3. Dialogue System Data & Milestone Evaluation', () => {
    it('contains all 8 required story sequences in priority order', () => {
      expect(STORY_SEQUENCES.length).toBe(8);
      const expectedIds = [
        'intro_welcome',
        'first_chore_unlocked',
        'first_frenzy_triggered',
        'territory_tier_2',
        'first_creature_caught',
        'territory_tier_3',
        'territory_tier_4',
        'territory_tier_5',
      ];

      expectedIds.forEach((id) => {
        const seq = STORY_SEQUENCES.find((s) => s.id === id);
        expect(seq, `Sequence ${id} must exist`).toBeDefined();
        expect(seq!.lines.length).toBeGreaterThan(0);
        seq!.lines.forEach((line) => {
          expect(line.speaker).toMatch(/nyah|fifi|master/);
          expect(line.text.length).toBeGreaterThan(5);
        });
      });
    });

    it('contains full ambient quote pools for both Nyah and Fifi', () => {
      const categories = ['idle', 'click', 'frenzy', 'catch'] as const;

      categories.forEach((cat) => {
        expect(NYAH_AMBIENT_QUOTES[cat].length).toBeGreaterThanOrEqual(4);
        expect(FIFI_AMBIENT_QUOTES[cat].length).toBeGreaterThanOrEqual(4);
      });
    });

    it('enforces strict zero em dash rule across all dialogue lines', () => {
      const emDashRegex = /[\u2014—]/;

      STORY_SEQUENCES.forEach((seq) => {
        seq.lines.forEach((line) => {
          expect(line.text).not.toMatch(emDashRegex);
        });
      });

      const categories = ['idle', 'click', 'frenzy', 'catch'] as const;
      categories.forEach((cat) => {
        NYAH_AMBIENT_QUOTES[cat].forEach((q) => expect(q).not.toMatch(emDashRegex));
        FIFI_AMBIENT_QUOTES[cat].forEach((q) => expect(q).not.toMatch(emDashRegex));
      });
    });

    it('evaluates story milestones accurately from GameState', () => {
      const completed = new Set<string>();

      // Initial state: intro_welcome should trigger
      const firstPending = getNextPendingMilestone(sim.getState(), completed);
      expect(firstPending).not.toBeNull();
      expect(firstPending!.id).toBe('intro_welcome');

      completed.add('intro_welcome');

      // Next check with no facilities purchased: nothing pending
      expect(getNextPendingMilestone(sim.getState(), completed)).toBeNull();

      // Purchase broom -> first_chore_unlocked triggers
      sim.addResource('gold', 100);
      sim.buyFacility('fifi_broom', 1);

      const chorePending = getNextPendingMilestone(sim.getState(), completed);
      expect(chorePending).not.toBeNull();
      expect(chorePending!.id).toBe('first_chore_unlocked');
    });
  });

  describe('4. Documentation & In-Character Notes Validation', () => {
    it('README.md exists and contains Windows PowerShell execution commands', () => {
      const readmePath = path.resolve(process.cwd(), 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf8');
      expect(content).toContain('npm.cmd install');
      expect(content).toContain('npm.cmd run dev');
      expect(content).toContain('npm.cmd test');
      expect(content).toContain('npm.cmd run build');
    });

    it('contains comprehensive documentation of all 4 drawer tabs and audio features', () => {
      const readmePath = path.resolve(process.cwd(), 'README.md');
      const content = fs.readFileSync(readmePath, 'utf8');

      expect(content).toMatch(/Fifi.*8 Chore Facilities|Broom|Duster/i);
      expect(content).toMatch(/Nyah.*4 Management Multipliers|Supervision|Inspection/i);
      expect(content).toMatch(/Territory Expansion|Dusty Parlor|Observatory/i);
      expect(content).toMatch(/Creature.*Sanctuaries|Purrble|Barkling/i);
      expect(content).toMatch(/Web Audio|synthesizer|BGM/i);
      expect(content).toMatch(/Speech Bubbles|Story Progression Modal/i);
    });

    it('contains in-character maintenance notes for all milestones with authentic Nyah and Fifi voices', () => {
      const readmePath = path.resolve(process.cwd(), 'README.md');
      const content = fs.readFileSync(readmePath, 'utf8');

      // Check for Milestone 5 notes specifically
      expect(content).toContain('Note from Nyah (Head Catgirl Maid): Milestone 5: Dialogue, Pixel-Art UI & Cozy Audio Update');
      expect(content).toContain('Note from Fifi (Junior Doggirl Maid): Milestone 5: Dialogue, Pixel-Art UI & Cozy Audio Update');

      // Persona checks
      expect(content).toMatch(/drawer interface|speech balloons|cozy procedural music/i);
      expect(content).toMatch(/sweeping a walkway|bulk bundles|berry tea/i);
    });

    it('confirms entire README.md contains zero em dashes', () => {
      const readmePath = path.resolve(process.cwd(), 'README.md');
      const content = fs.readFileSync(readmePath, 'utf8');
      const emDashRegex = /[\u2014—]/;
      expect(content).not.toMatch(emDashRegex);
    });
  });

  describe('5. Milestone 5 Remediation Verifications (worker_m5_2)', () => {
    it('verifies creature unassignment via simulation.assignCreature(spec.id, "") and "none"', () => {
      // Setup caught creature
      sim.getState().creatures.caught['purrble'] = {
        count: 2,
        level: 1,
        assignedHabitat: 'habitat_porch',
        xp: 0,
        isShiny: false,
      };

      const initialGps = sim.getTotalGPS();
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBe('habitat_porch');

      // Unassign with empty string ''
      const unassignSuccess = sim.assignCreature('purrble', '');
      expect(unassignSuccess).toBe(true);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBeUndefined();

      // GPS must decrease because unassigned creature yields are excluded
      const unassignedGps = sim.getTotalGPS();
      expect(unassignedGps).toBeLessThan(initialGps);

      // Reassign to habitat_porch
      const reassign = sim.assignCreature('purrble', 'habitat_porch');
      expect(reassign).toBe(true);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBe('habitat_porch');
      expect(sim.getTotalGPS()).toBe(initialGps);

      // Unassign with 'none'
      const unassignNone = sim.assignCreature('purrble', 'none');
      expect(unassignNone).toBe(true);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBeUndefined();
    });

    it('verifies StoryModal.close() clears onCompleteCallback and prevents duplicate invocations', () => {
      let callCount = 0;
      const modal = new StoryModal({
        nyahPortrait: Texture.EMPTY,
        fifiPortrait: Texture.EMPTY,
      });

      modal.playSequence(STORY_SEQUENCES[0], () => {
        callCount++;
      });

      // Calling close() once executes callback
      modal.close();
      expect(callCount).toBe(1);

      // Calling close() again does NOT re-execute callback
      modal.close();
      expect(callCount).toBe(1);
    });

    it('verifies HudDrawer dock layout has zero button overlap and at least 10px clear gutter before toggleBtn', () => {
      const audio = new AudioEngine();
      const drawer = new HudDrawer({ simulation: sim, audio });

      const soundControls: any = (drawer as any).soundControls;
      const toggleBtn: any = (drawer as any).toggleBtn;
      const choresBtn: any = (drawer as any).tabChoresBtn;
      const multipliersBtn: any = (drawer as any).tabMultipliersBtn;
      const territoryBtn: any = (drawer as any).tabTerritoryBtn;
      const sanctuaryBtn: any = (drawer as any).tabSanctuaryBtn;

      // SoundControls at x = 500
      expect(soundControls.position.x).toBe(500);

      // Tab buttons layout check: all tabs must end strictly before soundControls (x <= 495)
      const choresRight = choresBtn.position.x + choresBtn.btnWidth;
      const multRight = multipliersBtn.position.x + multipliersBtn.btnWidth;
      const terrRight = territoryBtn.position.x + territoryBtn.btnWidth;
      const sancRight = sanctuaryBtn.position.x + sanctuaryBtn.btnWidth;

      expect(choresRight).toBeLessThan(multipliersBtn.position.x);
      expect(multRight).toBeLessThan(territoryBtn.position.x);
      expect(terrRight).toBeLessThan(sanctuaryBtn.position.x);
      expect(sancRight).toBeLessThan(soundControls.position.x);

      // SFX [+] button position and width
      const sfxPlusBtn = soundControls.children.find(
        (c: any) => c.btnText === '+' && c.position.x > 300
      );
      expect(sfxPlusBtn).toBeDefined();

      const sfxPlusGlobalX = soundControls.position.x + sfxPlusBtn.position.x;
      const sfxPlusRight = sfxPlusGlobalX + (sfxPlusBtn.btnWidth ?? 18);

      const toggleX = toggleBtn.position.x; // 896

      // Assert at least 10px clear gutter between soundControls right edge and toggleBtn
      const gutter = toggleX - sfxPlusRight;
      expect(gutter).toBeGreaterThanOrEqual(10);

      // Assert zero overlap
      const toggleRight = toggleX + (toggleBtn.btnWidth ?? 34);
      const toggleTop = toggleBtn.position.y;
      const toggleBottom = toggleTop + (toggleBtn.btnHeight ?? 32);
      const sfxTop = soundControls.position.y + sfxPlusBtn.position.y;
      const sfxBottom = sfxTop + (sfxPlusBtn.btnHeight ?? 24);

      const overlapsX = toggleX < sfxPlusRight && toggleRight > sfxPlusGlobalX;
      const overlapsY = toggleTop < sfxBottom && toggleBottom > sfxTop;
      expect(overlapsX && overlapsY).toBe(false);
    });
  });
});
