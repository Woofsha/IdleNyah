// tests/stress/m4_remediation_adversarial.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import {
  CreatureSprite,
  CreaturesManager,
  HABITAT_CONFIGS,
} from '../../src/render/creatures';
import { EffectsManager } from '../../src/render/effects';
import { GameSimulation } from '../../src/core/simulation';
import { findSpecies } from '../../src/core/creatures';

// Headless polyfills for requestAnimationFrame
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}

describe('Milestone 4 Remediation Adversarial Stress Suite (challenger_m4_2_2)', () => {
  let entityLayer: Container;
  let effectsManager: EffectsManager;

  beforeEach(() => {
    entityLayer = new Container({ sortableChildren: true });
    effectsManager = new EffectsManager();
  });

  // =========================================================================
  // 1. Aggressive Multi-Threading / Rapid Click Spamming (500+ Clicks)
  // =========================================================================
  describe('1. Aggressive Rapid Click Spamming Under Hostile Conditions', () => {
    it('survives 1,000 rapid click spam on a single wild creature across catch and post-destruction states', () => {
      const simulation = new GameSimulation({ seed: 777 });
      simulation.addResource('treats', 20);
      const treatsStart = simulation.getState().currencies.treats;
      expect(treatsStart).toBe(20);

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      expect(wild).not.toBeNull();
      manager.update(0.05, simulation.getState());

      const wildSprite = manager.getWildCreatures()[0];
      expect(wildSprite).toBeDefined();

      let clickErrors: Error[] = [];
      let successCount = 0;
      let baitUsedCount = 0;

      // Spam 1,000 consecutive clicks through handleWildClick and event pointerdown
      for (let i = 0; i < 1000; i++) {
        const treatsBeforeClick = simulation.getState().currencies.treats;
        try {
          // Alternate direct method call and pointerdown event emission
          if (i % 2 === 0) {
            const res = manager.handleWildClick(wildSprite);
            if (res.success) successCount++;
          } else {
            let stopped = false;
            wildSprite.emit('pointerdown', { stopPropagation: () => { stopped = true; } } as any);
          }
        } catch (err: any) {
          clickErrors.push(err);
        }

        const treatsAfterClick = simulation.getState().currencies.treats;
        if (treatsAfterClick < treatsBeforeClick) {
          baitUsedCount += (treatsBeforeClick - treatsAfterClick);
        }
      }

      // Assert ZERO exceptions occurred during the 1,000 rapid clicks
      expect(clickErrors).toHaveLength(0);

      // Invariant: Sprite was destroyed once caught
      expect(wildSprite.destroyed).toBe(true);

      // Invariant: At most 1 successful catch registered in simulation state
      const caughtRoster = simulation.getState().creatures.caught['purrble'];
      expect(caughtRoster?.count).toBe(1);

      // Invariant: Treats were only consumed while creature was live, zero ghost bait consumption
      expect(simulation.getState().currencies.treats).toBeGreaterThanOrEqual(0);
      expect(simulation.getState().currencies.treats).toBe(treatsStart - baitUsedCount);

      // Invariant: Zero ghost sprites in entityLayer
      expect(entityLayer.children.includes(wildSprite)).toBe(false);
      expect(manager.getWildCreatures().length).toBe(0);
    });

    it('survives 600 rapid clicks across 5 wild creatures during simultaneous despawning and zone toggles', () => {
      const simulation = new GameSimulation({ seed: 888 });
      simulation.addResource('treats', 30);

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const speciesToSpawn = ['purrble', 'barkling', 'mooshrum', 'glimmerfin', 'silkwisp'];
      for (const sp of speciesToSpawn) {
        const def = findSpecies(sp)!;
        simulation.spawnWildCreature(def.spawnZoneId, def.id);
      }
      manager.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden', 'zone_03_pond_courtyard']);
      manager.update(0.05, simulation.getState());

      const initialSprites = [...manager.getWildCreatures()];
      expect(initialSprites.length).toBe(5);

      let clickErrors: Error[] = [];

      // Spam 600 clicks while concurrently advancing time and toggling unlocked zones
      for (let i = 0; i < 600; i++) {
        // Pick a target from initial sprites (some will become destroyed or expired mid-loop)
        const target = initialSprites[i % initialSprites.length];
        try {
          manager.handleWildClick(target);
        } catch (err: any) {
          clickErrors.push(err);
        }

        // Periodically tick simulation and advance zone toggles
        if (i % 50 === 0) {
          simulation.tick(500); // 0.5s in ms
          // Toggle zones
          if (i % 100 === 0) {
            manager.setUnlockedZones(['zone_01_parlor']);
          } else {
            manager.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden', 'zone_03_pond_courtyard']);
          }
          manager.update(0.05, simulation.getState());
        }
      }

      expect(clickErrors).toHaveLength(0);
      expect(simulation.getState().currencies.treats).toBeGreaterThanOrEqual(0);

      // Check entityLayer child integrity: all children must be non-destroyed
      for (const child of entityLayer.children) {
        expect((child as any).destroyed).toBe(false);
      }
    });

    it('survives 500 rapid clicks on habitat creatures during habitat relocking and desynchronization', () => {
      const simulation = new GameSimulation({ seed: 456 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Populate caught creatures in Garden and Pond habitats
      const state = simulation.getState();
      state.creatures.caught = {
        purrble: { count: 3, level: 1, assignedHabitat: 'habitat_porch', xp: 0 },
        barkling: { count: 3, level: 1, assignedHabitat: 'habitat_garden', xp: 0 },
        glimmerfin: { count: 3, level: 1, assignedHabitat: 'habitat_pond', xp: 0 },
      };

      manager.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden', 'zone_03_pond_courtyard']);
      manager.update(0.05, state);

      const gardenCreatures = manager.getHabitatCreatures('habitat_garden');
      const pondCreatures = manager.getHabitatCreatures('habitat_pond');
      const allCreatures = [...gardenCreatures, ...pondCreatures];
      expect(allCreatures.length).toBeGreaterThan(0);

      let clickErrors: Error[] = [];

      // Rapidly click 500 times while relocking and unlocking zones
      for (let i = 0; i < 500; i++) {
        const sprite = allCreatures[i % allCreatures.length];
        try {
          // Pet directly or through click callback
          (sprite as any).onClickCallback(sprite);
        } catch (err: any) {
          clickErrors.push(err);
        }

        // Relock garden mid-spam at step 150
        if (i === 150) {
          manager.setUnlockedZones(['zone_01_parlor', 'zone_03_pond_courtyard']);
          manager.update(0.05, state);
        }

        // Relock pond at step 300
        if (i === 300) {
          manager.setUnlockedZones(['zone_01_parlor']);
          manager.update(0.05, state);
        }
      }

      // Zero crashes or TypeError on destroyed habitat containers
      expect(clickErrors).toHaveLength(0);
    });

    it('rapid click spam during natural despawn / expiry transitions preserves zero ghost sprites', () => {
      const simulation = new GameSimulation({ seed: 123 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Spawn a wild creature
      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      expect(wild).not.toBeNull();
      manager.update(0.05, simulation.getState());

      const sprite = manager.getWildCreatures()[0];
      expect(sprite).toBeDefined();

      // Force creature timer to near expiry (timer = 0.1s)
      wild!.timer = 0.1;

      let clickErrors: Error[] = [];
      // Spam 500 clicks while simulation steps across the expiration threshold
      for (let i = 0; i < 500; i++) {
        try {
          manager.handleWildClick(sprite);
        } catch (err: any) {
          clickErrors.push(err);
        }

        if (i === 50) {
          // Step simulation by 200ms to trigger natural expiration
          simulation.tick(200);
          manager.update(0.05, simulation.getState());
        }
      }

      expect(clickErrors).toHaveLength(0);
      // Sprite must be destroyed and removed
      expect(sprite.destroyed).toBe(true);
      expect(entityLayer.children.includes(sprite)).toBe(false);
      expect(manager.getWildCreatures()).toHaveLength(0);
    });
  });

  // =========================================================================
  // 2. Inactive / Ghost Catch Roll Fuzzing
  // =========================================================================
  describe('2. Inactive / Ghost Catch Roll Fuzzing', () => {
    it('fuzzes attemptCatchCreature with 1,000 invalid, null, undefined, expired, and caught IDs', () => {
      const simulation = new GameSimulation({ seed: 999 });
      simulation.addResource('treats', 100);
      const initialTreats = simulation.getState().currencies.treats;
      expect(initialTreats).toBe(100);

      // 1. Setup real creature that gets caught
      let realCaughtId = '';
      while (!realCaughtId) {
        const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble')!;
        const res = simulation.attemptCatchCreature(wild.id, false);
        if (res.success) {
          realCaughtId = wild.id;
        }
      }
      expect(realCaughtId).not.toBe('');
      expect(simulation.getState().creatures.wildActive.some((w) => w.id === realCaughtId)).toBe(false);

      // 2. Setup real creature that expires
      const expiredWild = simulation.spawnWildCreature('zone_01_parlor', 'barkling')!;
      const realExpiredId = expiredWild.id;
      simulation.tick(100000); // 100s to expire it
      expect(simulation.getState().creatures.wildActive.some((w) => w.id === realExpiredId)).toBe(false);

      const treatsAfterSetup = simulation.getState().currencies.treats;

      // Build fuzz corpus
      const fuzzCorpus = [
        realCaughtId,
        realExpiredId,
        '',
        '   ',
        'null',
        'undefined',
        'NaN',
        '0',
        '-1',
        'wild_999999_nonexistent',
        '../../src/core/simulation',
        '{"id": "exploit"}',
        '<script>alert(1)</script>',
        '__proto__',
        'constructor',
        null as unknown as string,
        undefined as unknown as string,
        12345 as unknown as string,
        {} as unknown as string,
        [] as unknown as string,
        true as unknown as string,
      ];

      // Fuzz 1,000 iterations
      for (let i = 0; i < 1000; i++) {
        const idToTest = fuzzCorpus[i % fuzzCorpus.length];
        const useBait = i % 2 === 0;

        const res = simulation.attemptCatchCreature(idToTest, useBait);

        // STRICTURE 1: success must be strictly false
        expect(res.success).toBe(false);

        // STRICTURE 2: fled must be strictly false (never true for non-active instances)
        expect(res.fled).toBe(false);

        // STRICTURE 3: Treat currency must NEVER be deducted
        expect(simulation.getState().currencies.treats).toBe(treatsAfterSetup);
      }

      // Check caught counts remain uncorrupted
      expect(simulation.getState().creatures.caught['purrble']?.count).toBe(1);
      expect(simulation.getState().creatures.caught['barkling']).toBeUndefined();
    });

    it('verifies handleWildClick suppresses floating banners and does not mutate treats on fuzzed IDs', () => {
      const simulation = new GameSimulation({ seed: 54321 });
      simulation.addResource('treats', 50);

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const invalidIds = ['fake_1', 'fake_2', '', 'null', 'expired_99'];
      for (const invId of invalidIds) {
        const fakeSprite = new CreatureSprite({
          speciesId: 'purrble',
          isWild: true,
          wildInstanceId: invId,
          x: 10,
          y: 20,
        });

        const treatsBefore = simulation.getState().currencies.treats;
        const effectsBefore = effectsManager.container.children.length;

        const res = manager.handleWildClick(fakeSprite);

        expect(res.success).toBe(false);
        expect(res.fled).toBe(false);

        // Zero floating text or sparkle banners spawned
        const effectsAfter = effectsManager.container.children.length;
        expect(effectsAfter).toBe(effectsBefore);

        // Zero treats consumed
        expect(simulation.getState().currencies.treats).toBe(treatsBefore);

        fakeSprite.destroy();
      }
    });
  });

  // =========================================================================
  // 3. Chaos Monkey Harness (Random Interleaved Hostile Actions)
  // =========================================================================
  describe('3. Chaos Monkey Interleaved Simulation & Rendering Stress', () => {
    it('executes 200 cycles of chaotic interleaved operations with invariant assertions', () => {
      const simulation = new GameSimulation({ seed: 1337 });
      simulation.addResource('treats', 100);

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const zones = [
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ];
      manager.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden']);

      for (let cycle = 0; cycle < 200; cycle++) {
        const action = cycle % 6;

        switch (action) {
          case 0: {
            // Spawn wild creature
            const spList = ['purrble', 'barkling', 'mooshrum'];
            const sp = spList[cycle % spList.length];
            simulation.spawnWildCreature('zone_01_parlor', sp);
            break;
          }
          case 1: {
            // Rapid click wild creatures (10 clicks)
            const wildSprites = manager.getWildCreatures();
            for (let k = 0; k < 10; k++) {
              if (wildSprites.length > 0) {
                const target = wildSprites[k % wildSprites.length];
                manager.handleWildClick(target);
              }
            }
            break;
          }
          case 2: {
            // Advance simulation with random delta
            const dtMs = (cycle % 10) * 100;
            simulation.tick(dtMs);
            break;
          }
          case 3: {
            // Toggle zone unlocks
            const count = (cycle % zones.length) + 1;
            manager.setUnlockedZones(zones.slice(0, count));
            break;
          }
          case 4: {
            // Pet habitat creatures
            const habitats = ['habitat_porch', 'habitat_garden'];
            for (const hab of habitats) {
              const pets = manager.getHabitatCreatures(hab);
              for (const p of pets) {
                (p as any).onClickCallback(p);
              }
            }
            break;
          }
          case 5: {
            // Fuzz catch roll with dead or invalid ID
            const deadId = `dead_${cycle}`;
            const res = simulation.attemptCatchCreature(deadId, true);
            expect(res.fled).toBe(false);
            expect(res.success).toBe(false);
            break;
          }
        }

        // Tick manager rendering
        manager.update(0.016, simulation.getState());

        // Invariant checks on every cycle
        expect(simulation.getState().currencies.treats).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(simulation.getState().currencies.gold)).toBe(true);

        // Every child in entityLayer must not be destroyed
        for (const child of entityLayer.children) {
          expect((child as any).destroyed).toBe(false);
        }
      }
    });
  });
});
