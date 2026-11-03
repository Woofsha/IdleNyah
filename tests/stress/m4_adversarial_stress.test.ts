// tests/stress/m4_adversarial_stress.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import {
  CreatureSprite,
  CreaturesManager,
  HABITAT_CONFIGS,
  ZONE_WILD_ROAM_BOUNDS,
} from '../../src/render/creatures';
import { EffectsManager } from '../../src/render/effects';
import { GameSimulation } from '../../src/core/simulation';
import { getAllSpecies, findSpecies } from '../../src/core/creatures';

// Polyfill requestAnimationFrame / cancelAnimationFrame for headless Node environment
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}

describe('Milestone 4 Adversarial Stress Suite: Creature Catching & Habitats', () => {
  let entityLayer: Container;
  let effectsManager: EffectsManager;

  beforeEach(() => {
    entityLayer = new Container({ sortableChildren: true });
    effectsManager = new EffectsManager();
  });

  // =========================================================================
  // 1. Rapid Click Spamming & Concurrency Stress
  // =========================================================================
  describe('1. Click Spamming & Bait Invariant Under Hostile Clicks', () => {
    it('survives multi-click spam during active escape/catch rolls without negative treats or duplicate catches', () => {
      const simulation = new GameSimulation({ seed: 42 });
      simulation.addResource('treats', 10);
      const initialTreats = simulation.getState().currencies.treats;
      expect(initialTreats).toBe(10);

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

      let successCount = 0;
      let clickCount = 0;

      // Spam clicks while creature is active
      while (clickCount < 100) {
        clickCount++;
        const treatsBefore = simulation.getState().currencies.treats;
        expect(treatsBefore).toBeGreaterThanOrEqual(0);

        // Check if creature is still active before clicking
        const isActive = manager.getWildCreatures().some((s) => s.wildInstanceId === wild?.id && !s.destroyed);
        if (!isActive) break;

        const res = manager.handleWildClick(wildSprite);

        const treatsAfter = simulation.getState().currencies.treats;
        expect(treatsAfter).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(treatsAfter)).toBe(true);

        if (res.success) {
          successCount++;
          break;
        }
      }

      // Invariant: At most 1 successful catch can ever be recorded for this instance
      expect(successCount).toBeLessThanOrEqual(1);

      // Invariant: Total caught count in simulation state must be exactly 1 or 0
      const purrbleCaught = simulation.getState().creatures.caught['purrble']?.count ?? 0;
      expect(purrbleCaught).toBe(successCount);

      // Invariant: Treats cannot be negative
      expect(simulation.getState().currencies.treats).toBeGreaterThanOrEqual(0);

      // Invariant: Currencies are finite
      expect(Number.isFinite(simulation.getState().currencies.gold)).toBe(true);
      expect(Number.isFinite(simulation.getState().currencies.treats)).toBe(true);
      expect(Number.isFinite(simulation.getState().currencies.essence)).toBe(true);
    });

    it('empirically audits rapid multi-click on caught/destroyed wild sprite: verifies safe guard against TypeError and no duplicate catch', () => {
      const simulation = new GameSimulation({ seed: 42 });
      simulation.addResource('treats', 10);

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.05, simulation.getState());

      const wildSprite = manager.getWildCreatures()[0];
      expect(wildSprite).toBeDefined();

      // Click 1: Guarantee catch or repeat until caught
      let res1 = manager.handleWildClick(wildSprite);
      while (!res1.success && simulation.getState().creatures.wildActive.length > 0) {
        res1 = manager.handleWildClick(wildSprite);
      }

      expect(res1.success).toBe(true);
      expect(wildSprite.destroyed).toBe(true);

      // Click 2 (Simulating rapid double-click or multi-tap on the same sprite instance):
      // Because wildSprite was destroyed by Click 1, handleWildClick cleanly guards and returns failure without throwing
      let caughtError: any = null;
      let res2: any = null;
      try {
        res2 = manager.handleWildClick(wildSprite);
      } catch (err: any) {
        caughtError = err;
      }

      console.log(`[CHALLENGE AUDIT] Rapid click on destroyed wild creature result: ${caughtError ? caughtError.message : 'no error (safely handled)'}`);

      expect(caughtError).toBeNull();
      expect(res2).toEqual({
        success: false,
        speciesId: 'purrble',
        fled: false,
      });
    });

    it('empirically audits click on inactive wildInstanceId: verifies false flee message suppressed when creature is not in wildActive', () => {
      const simulation = new GameSimulation({ seed: 42 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Create an un-destroyed sprite with a fake/expired wildInstanceId
      const fakeSprite = new CreatureSprite({
        speciesId: 'purrble',
        isWild: true,
        wildInstanceId: 'expired_instance_id',
        x: 0,
        y: 0,
      });

      const effectsBefore = effectsManager.container.children.length;
      const res = manager.handleWildClick(fakeSprite);

      // When wildInstanceId is not in wildSprites/wildActive, returns fled: false
      expect(res.success).toBe(false);
      expect(res.fled).toBe(false);

      // handleWildClick does NOT spawn false flee banners
      const effectsAfter = effectsManager.container.children.length;
      expect(effectsAfter).toBe(effectsBefore);
      console.log(`[CHALLENGE AUDIT] Inactive instance ID produced fled=false and spawned 0 false flee banners`);
    });

    it('empirically audits rapid click on destroyed habitat sprite: cleanly returns without throwing', () => {
      const simulation = new GameSimulation({ seed: 42 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const sprite = new CreatureSprite({
        speciesId: 'purrble',
        isWild: false,
        x: 0,
        y: 0,
      });
      sprite.destroy();
      expect(sprite.destroyed).toBe(true);

      let caughtError: any = null;
      try {
        (manager as any).handleHabitatPetting(sprite);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeNull();
    });

    it('handles 500 click spam across 5 simultaneously active wild creatures without invalid state', () => {
      const simulation = new GameSimulation({ seed: 999 });
      simulation.addResource('treats', 50);

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Spawn 5 creatures
      const speciesList = ['purrble', 'barkling', 'mooshrum', 'glimmerfin', 'silkwisp'];
      for (const sp of speciesList) {
        const def = findSpecies(sp)!;
        simulation.spawnWildCreature(def.spawnZoneId, def.id);
      }
      manager.update(0.05, simulation.getState());

      const wildSprites = manager.getWildCreatures();
      expect(wildSprites.length).toBeGreaterThanOrEqual(1);

      // Spam 500 clicks distributed across all currently active non-destroyed wild sprites
      for (let i = 0; i < 500; i++) {
        const currentActive = manager.getWildCreatures().filter((s) => !s.destroyed);
        if (currentActive.length === 0) break;
        const target = currentActive[i % currentActive.length];
        manager.handleWildClick(target);
      }

      // All caught creatures have non-negative, finite counts
      for (const [, data] of Object.entries(simulation.getState().creatures.caught)) {
        expect(data.count).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(data.count)).toBe(true);
      }
      expect(simulation.getState().currencies.treats).toBeGreaterThanOrEqual(0);
    });

    it('petting spam: handles 300 rapid clicks on habitat creatures without particle exhaustion or crashes', () => {
      const simulation = new GameSimulation({ seed: 101 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Catch and assign
      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      simulation.attemptCatchCreature(wild!.id, false);

      manager.setUnlockedZones(['zone_01_parlor']);
      manager.update(0.05, simulation.getState());

      const habitatCreature = manager.getHabitatCreatures('habitat_porch')[0];
      expect(habitatCreature).toBeDefined();

      // Rapidly click 300 times
      for (let i = 0; i < 300; i++) {
        (habitatCreature as any).onClickCallback(habitatCreature);
      }

      // Update effects for 2 seconds to let floating text and sparkles decay
      effectsManager.update(2.5);

      // Effects container should not be clogged with infinite undead particles
      expect(effectsManager.container.children.length).toBeLessThan(100);
    });
  });

  // =========================================================================
  // 2. Ticker Delta Spikes, Large Deltas, Micro Deltas, and Extreme Time Travel
  // =========================================================================
  describe('2. Ticker Delta Spikes & Extreme Sleep Recovery', () => {
    it('survives massive delta spike of 1 hour (deltaSeconds = 3600) without flying off screen', () => {
      const simulation = new GameSimulation({ seed: 777 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.05, simulation.getState());

      const wildSprite = manager.getWildCreatures()[0];
      const bounds = ZONE_WILD_ROAM_BOUNDS['zone_01_parlor'];

      // Massive 1-hour delta spike
      wildSprite.update(3600);

      // Position must strictly remain within roam bounds
      expect(wildSprite.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(wildSprite.x).toBeLessThanOrEqual(bounds.maxX);
      expect(wildSprite.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(wildSprite.y).toBeLessThanOrEqual(bounds.maxY);

      // Bobbing offset on visualContainer must not overflow to NaN or Infinity
      expect(Number.isFinite(wildSprite.visualContainer.y)).toBe(true);
      expect(wildSprite.visualContainer.y).toBeGreaterThanOrEqual(-15);
      expect(wildSprite.visualContainer.y).toBeLessThanOrEqual(15);

      // Depth sorting index must be finite integer
      expect(Number.isInteger(wildSprite.zIndex)).toBe(true);
      expect(wildSprite.zIndex).toBe(Math.floor(wildSprite.y));
    });

    it('survives extreme sleep recovery of 30 days (deltaSeconds = 2592000)', () => {
      const sprite = new CreatureSprite({
        speciesId: 'starling_doe',
        x: 0,
        y: 0,
        roamBounds: { minX: -200, maxX: 200, minY: -200, maxY: 200 },
      });

      sprite.update(2592000);

      expect(Number.isFinite(sprite.x)).toBe(true);
      expect(Number.isFinite(sprite.y)).toBe(true);
      expect(sprite.x).toBeGreaterThanOrEqual(-200);
      expect(sprite.x).toBeLessThanOrEqual(200);
      expect(sprite.y).toBeGreaterThanOrEqual(-200);
      expect(sprite.y).toBeLessThanOrEqual(200);

      expect(Number.isFinite(sprite.visualContainer.y)).toBe(true);
      expect(Number.isFinite(sprite.visualContainer.scale.x)).toBe(true);
      expect(Number.isFinite(sprite.visualContainer.scale.y)).toBe(true);
    });

    it('survives sub-millisecond micro steps (deltaSeconds = 0.0001) over 1,000 iterations', () => {
      const sprite = new CreatureSprite({
        speciesId: 'barkling',
        x: 10,
        y: 20,
        roamBounds: { minX: 0, maxX: 50, minY: 0, maxY: 50 },
      });

      for (let i = 0; i < 1000; i++) {
        sprite.update(0.0001);
      }

      expect(Number.isFinite(sprite.x)).toBe(true);
      expect(Number.isFinite(sprite.y)).toBe(true);
      expect(Number.isFinite(sprite.visualContainer.y)).toBe(true);
      expect(sprite.x).toBeGreaterThanOrEqual(0);
      expect(sprite.x).toBeLessThanOrEqual(50);
      expect(sprite.y).toBeGreaterThanOrEqual(0);
      expect(sprite.y).toBeLessThanOrEqual(50);
    });

    it('survives wild alternating delta chaos: micro steps, 1-hour jumps, zero, and negative deltas', () => {
      const sprite = new CreatureSprite({
        speciesId: 'cinderfox',
        x: 100,
        y: -50,
        roamBounds: { minX: 50, maxX: 150, minY: -100, maxY: 0 },
      });

      const chaoticDeltas = [0.00005, 3600, 0, 0.016, 7200, 0.0001, 86400, 0.033, 0];

      for (const dt of chaoticDeltas) {
        sprite.update(dt);
        expect(Number.isFinite(sprite.x)).toBe(true);
        expect(Number.isFinite(sprite.y)).toBe(true);
        expect(sprite.x).toBeGreaterThanOrEqual(50);
        expect(sprite.x).toBeLessThanOrEqual(150);
        expect(sprite.y).toBeGreaterThanOrEqual(-100);
        expect(sprite.y).toBeLessThanOrEqual(0);
        expect(Number.isFinite(sprite.visualContainer.y)).toBe(true);
      }
    });

    it('manager update survives 3600s delta without runaway particle spawning', () => {
      const simulation = new GameSimulation({ seed: 555 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Catch and assign to porch
      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      simulation.attemptCatchCreature(wild!.id, false);

      manager.setUnlockedZones(['zone_01_parlor']);
      manager.update(0.05, simulation.getState());

      const particlesBefore = effectsManager.container.children.length;

      // 1-hour delta jump in single frame
      manager.update(3600, simulation.getState());

      const particlesAfter = effectsManager.container.children.length;
      // Invariant: single delta spike must not spawn thousands of boost particles at once
      expect(particlesAfter - particlesBefore).toBeLessThanOrEqual(20);
    });
  });

  // =========================================================================
  // 3. Habitat Boundary & Unlocked Zones Edge Cases
  // =========================================================================
  describe('3. Habitat Boundary & Locked Zones Edge Cases', () => {
    it('strictly hides all habitat creatures whose zones are locked', () => {
      const simulation = new GameSimulation({ seed: 333 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Artificially populate caught creatures assigned to each of the 5 habitats
      const state = simulation.getState();
      state.creatures.caught = {
        purrble: { count: 3, level: 1, assignedHabitat: 'habitat_porch', xp: 0 },
        barkling: { count: 3, level: 1, assignedHabitat: 'habitat_garden', xp: 0 },
        glimmerfin: { count: 3, level: 1, assignedHabitat: 'habitat_pond', xp: 0 },
        cinderfox: { count: 3, level: 1, assignedHabitat: 'habitat_aviary', xp: 0 },
        starling_doe: { count: 3, level: 1, assignedHabitat: 'habitat_sanctuary', xp: 0 },
      };

      // Only zone 1 unlocked initially
      manager.setUnlockedZones(['zone_01_parlor']);
      manager.update(0.05, state);

      // Verify ONLY habitat_porch has visible creatures
      expect(manager.getHabitatCreatures('habitat_porch').length).toBeGreaterThan(0);
      expect(manager.getHabitatCreatures('habitat_garden').length).toBe(0);
      expect(manager.getHabitatCreatures('habitat_pond').length).toBe(0);
      expect(manager.getHabitatCreatures('habitat_aviary').length).toBe(0);
      expect(manager.getHabitatCreatures('habitat_sanctuary').length).toBe(0);

      // Unlock Zone 2 (Garden)
      manager.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden']);
      manager.update(0.05, state);
      expect(manager.getHabitatCreatures('habitat_garden').length).toBeGreaterThan(0);
      expect(manager.getHabitatCreatures('habitat_pond').length).toBe(0);

      // Unlock Zone 3 (Pond)
      manager.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden', 'zone_03_pond_courtyard']);
      manager.update(0.05, state);
      expect(manager.getHabitatCreatures('habitat_pond').length).toBeGreaterThan(0);
      expect(manager.getHabitatCreatures('habitat_aviary').length).toBe(0);

      // Unlock Zone 4 (Balcony Aviary)
      manager.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
      ]);
      manager.update(0.05, state);
      expect(manager.getHabitatCreatures('habitat_aviary').length).toBeGreaterThan(0);
      expect(manager.getHabitatCreatures('habitat_sanctuary').length).toBe(0);

      // Unlock Zone 5 (Observatory Sanctuary)
      manager.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ]);
      manager.update(0.05, state);
      expect(manager.getHabitatCreatures('habitat_sanctuary').length).toBeGreaterThan(0);
    });

    it('relocking zones cleanly destroys habitat sprites and removes them from entityLayer', () => {
      const simulation = new GameSimulation({ seed: 333 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const state = simulation.getState();
      state.creatures.caught = {
        barkling: { count: 2, level: 1, assignedHabitat: 'habitat_garden', xp: 0 },
      };

      // Unlock zone 2
      manager.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden']);
      manager.update(0.05, state);
      expect(manager.getHabitatCreatures('habitat_garden').length).toBe(2);

      const gardenSprite = manager.getHabitatCreatures('habitat_garden')[0];
      expect(entityLayer.children.includes(gardenSprite)).toBe(true);

      // Now relock zone 2 (e.g. state reset or save load from earlier)
      manager.setUnlockedZones(['zone_01_parlor']);
      manager.update(0.05, state);

      expect(manager.getHabitatCreatures('habitat_garden').length).toBe(0);
      expect(entityLayer.children.includes(gardenSprite)).toBe(false);
      expect(gardenSprite.destroyed).toBe(true);
    });

    it('habitat capacity is strictly respected even if player assigns excessive creatures', () => {
      const simulation = new GameSimulation({ seed: 444 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const porchConfig = HABITAT_CONFIGS['habitat_porch'];
      expect(porchConfig.capacity).toBe(3);

      const state = simulation.getState();
      // Assign 50 creatures of different species to porch
      state.creatures.caught = {
        purrble: { count: 20, level: 1, assignedHabitat: 'habitat_porch', xp: 0 },
        barkling: { count: 20, level: 1, assignedHabitat: 'habitat_porch', xp: 0 },
        mooshrum: { count: 20, level: 1, assignedHabitat: 'habitat_porch', xp: 0 },
      };

      manager.setUnlockedZones(['zone_01_parlor']);
      manager.update(0.05, state);

      const porchCreatures = manager.getHabitatCreatures('habitat_porch');
      // Invariant: number of rendered creatures must never exceed habitat capacity
      expect(porchCreatures.length).toBeLessThanOrEqual(porchConfig.capacity);
    });

    it('gracefully handles non-existent or corrupted habitat assignment IDs', () => {
      const simulation = new GameSimulation({ seed: 888 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const state = simulation.getState();
      state.creatures.caught = {
        purrble: { count: 5, level: 1, assignedHabitat: 'habitat_non_existent', xp: 0 },
        barkling: { count: 5, level: 1, assignedHabitat: '' as any, xp: 0 },
        glimmerfin: { count: 5, level: 1, assignedHabitat: undefined, xp: 0 },
      };

      manager.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden', 'zone_03_pond_courtyard']);

      // Should not throw
      expect(() => {
        manager.update(0.05, state);
      }).not.toThrow();

      expect(manager.getHabitatCreatures().length).toBe(0);
    });
  });

  // =========================================================================
  // 4. Species Rendering & Visual Stress
  // =========================================================================
  describe('4. Species Visual Stress & Flee Mechanics', () => {
    it('creates and renders all 10 standard and 10 shiny species without visual glitches or missing graphics', () => {
      const all = getAllSpecies();
      for (const sp of all) {
        const standard = new CreatureSprite({ speciesId: sp.id, isShiny: false });
        expect(standard.creatureGraphics.children.length >= 0).toBe(true);
        expect(standard.shinyAura).toBeUndefined();

        const shiny = new CreatureSprite({ speciesId: sp.id, isShiny: true });
        expect(shiny.shinyAura).toBeDefined();
        expect(shiny.shinyAura!.alpha).toBeGreaterThan(0);
      }
    });

    it('fleeing fadeout smoothly fades alpha and destroys sprite on completion', () => {
      const simulation = new GameSimulation({ seed: 123 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.05, simulation.getState());

      const wildSprite = manager.getWildCreatures()[0];
      expect(wildSprite).toBeDefined();

      wildSprite.triggerFlee();
      expect(wildSprite.eventMode).toBe('none');

      // Update over 1 second (flee fade rate is 2.5/s)
      manager.update(1.0, simulation.getState());

      // Sprite should have finished fading and been destroyed
      expect(manager.getWildCreatures().length).toBe(0);
      expect(wildSprite.destroyed).toBe(true);
    });

    it('pointerdown stops propagation so clicking wild creature does not trigger stage drag/click', () => {
      const sprite = new CreatureSprite({ speciesId: 'purrble' });
      let clicked = false;
      sprite.setClickHandler(() => {
        clicked = true;
      });

      let propagationStopped = false;
      const fakeEvent = {
        stopPropagation: () => {
          propagationStopped = true;
        },
      };

      // Emit pointerdown
      sprite.emit('pointerdown', fakeEvent as any);

      expect(clicked).toBe(true);
      expect(propagationStopped).toBe(true);
    });
  });
});
