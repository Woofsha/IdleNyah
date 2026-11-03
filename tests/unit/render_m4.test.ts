// tests/unit/render_m4.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Container, Rectangle, Texture, TextureSource } from 'pixi.js';
import {
  CreatureSprite,
  CreaturesManager,
  HABITAT_CONFIGS,
  ZONE_WILD_ROAM_BOUNDS,
} from '../../src/render/creatures';
import { EffectsManager } from '../../src/render/effects';
import { GameSimulation } from '../../src/core/simulation';
import { getAllSpecies } from '../../src/core/creatures';

// Polyfill requestAnimationFrame / cancelAnimationFrame for headless Node environment
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}

describe('Milestone 4: Original Creature Catching & Habitats Unit Test Suite', () => {
  let entityLayer: Container;
  let effectsManager: EffectsManager;

  beforeEach(() => {
    entityLayer = new Container({ sortableChildren: true });
    effectsManager = new EffectsManager();
  });

  // =========================================================================
  // 1. Feature 17: Original Creature Pixel Art & Sprites
  // =========================================================================
  describe('1. Feature 17: CreatureSprite & 10 Species Pixel Art Visuals', () => {
    const allSpecies = getAllSpecies();

    it('successfully instantiates CreatureSprite for all 10 original species', () => {
      expect(allSpecies).toHaveLength(10);

      for (const spec of allSpecies) {
        const sprite = new CreatureSprite({
          speciesId: spec.id,
          x: 50,
          y: 75,
        });

        expect(sprite).toBeDefined();
        expect(sprite.speciesId).toBe(spec.id);
        expect(sprite.speciesDef.name).toBe(spec.name);
        expect(sprite.shadow).toBeDefined();
        expect(sprite.visualContainer).toBeDefined();
        expect(sprite.creatureGraphics).toBeDefined();
        expect(sprite.zIndex).toBe(75);
      }
    });

    it('renders distinct shiny variants for all 10 species with shiny aura', () => {
      for (const spec of allSpecies) {
        const shinySprite = new CreatureSprite({
          speciesId: spec.id,
          isShiny: true,
          x: 0,
          y: 0,
        });

        expect(shinySprite.isShiny).toBe(true);
        expect(shinySprite.shinyAura).toBeDefined();
      }
    });

    it('has an ellipse drop shadow at ground origin', () => {
      const sprite = new CreatureSprite({ speciesId: 'purrble' });
      expect(sprite.shadow).toBeDefined();
      expect(sprite.shadow.x).toBe(0);
      expect(sprite.shadow.y).toBe(0);
    });

    it('updates direction facing properly by flipping scale.x on visualContainer', () => {
      const sprite = new CreatureSprite({ speciesId: 'cinderfox' });
      expect(sprite.facing).toBe('right');
      expect(sprite.visualContainer.scale.x).toBe(1);

      sprite.setFacing('left');
      expect(sprite.facing).toBe('left');
      expect(sprite.visualContainer.scale.x).toBe(-1);

      sprite.setFacing('right');
      expect(sprite.facing).toBe('right');
      expect(sprite.visualContainer.scale.x).toBe(1);
    });

    it('dynamically sorts depth with zIndex = Math.floor(y)', () => {
      const sprite = new CreatureSprite({ speciesId: 'barkling', x: 20, y: 142.7 });
      expect(sprite.zIndex).toBe(142);

      sprite.y = 210.3;
      sprite.updateZIndex();
      expect(sprite.zIndex).toBe(210);
    });

    it('animates idle bobbing and hop cycles', () => {
      const sprite = new CreatureSprite({ speciesId: 'mooshrum' });
      const initialY = sprite.visualContainer.y;

      sprite.update(0.25);
      // Bobbing changes visualContainer.y relative to shadow
      expect(sprite.visualContainer.y).not.toBe(initialY);
    });
  });

  // =========================================================================
  // 2. Feature 18: Wild Creature Spawning & Movement
  // =========================================================================
  describe('2. Feature 18: Wild Creature Spawning & Autonomous Movement', () => {
    it('synchronizes wild creatures from simulation state', () => {
      const simulation = new GameSimulation({ seed: 42 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Initially no wild creatures
      expect(manager.getWildCreatures()).toHaveLength(0);

      // Spawn a wild creature in simulation
      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      expect(wild).not.toBeNull();

      // Update manager
      manager.update(0.1, simulation.getState());
      const wildList = manager.getWildCreatures();
      expect(wildList).toHaveLength(1);
      expect(wildList[0].speciesId).toBe('purrble');
      expect(wildList[0].wildInstanceId).toBe(wild?.id);
    });

    it('despawns and destroys wild creatures when expired or caught in simulation', () => {
      const simulation = new GameSimulation({ seed: 42 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.1, simulation.getState());
      expect(manager.getWildCreatures()).toHaveLength(1);

      // Manually catch or remove from simulation state
      simulation.attemptCatchCreature(wild!.id, false);
      expect(simulation.getState().creatures.wildActive).toHaveLength(0);

      // Update manager: should trigger flee/removal
      manager.update(0.1, simulation.getState());
      // Sprite is fleeing with fading alpha
      const wildSprite = manager.getWildCreatures()[0];
      if (wildSprite) {
        // Advance time to complete fade
        manager.update(2.0, simulation.getState());
      }
      expect(manager.getWildCreatures()).toHaveLength(0);
    });

    it('restricts wild creature movement within designated zone bounds', () => {
      const simulation = new GameSimulation({ seed: 99 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.1, simulation.getState());

      const wildSprite = manager.getWildCreatures()[0];
      const bounds = ZONE_WILD_ROAM_BOUNDS['zone_01_parlor'];

      // Simulate 100 frames of movement
      for (let i = 0; i < 100; i++) {
        wildSprite.update(0.05);
        expect(wildSprite.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(wildSprite.x).toBeLessThanOrEqual(bounds.maxX);
        expect(wildSprite.y).toBeGreaterThanOrEqual(bounds.minY);
        expect(wildSprite.y).toBeLessThanOrEqual(bounds.maxY);
      }
    });
  });

  // =========================================================================
  // 3. Feature 19: Interactive Creature Catching
  // =========================================================================
  describe('3. Feature 19: Interactive Catching & Bait Mechanics', () => {
    it('clicking a wild creature calls attemptCatchCreature and handles success', () => {
      const simulation = new GameSimulation({ seed: 1234 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Force guaranteed catch species or seed
      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.1, simulation.getState());

      const wildSprite = manager.getWildCreatures()[0];
      expect(wildSprite).toBeDefined();

      // Trigger catch click
      let catchResult = manager.handleWildClick(wildSprite);

      // If failed on random roll, retry until caught to verify full success pipeline
      let tries = 0;
      while (!catchResult.success && tries < 20) {
        tries++;
        const nextWild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
        manager.update(0.1, simulation.getState());
        const sprite = manager.getWildCreatures().find((s) => s.wildInstanceId === nextWild?.id);
        if (sprite) {
          catchResult = manager.handleWildClick(sprite);
        }
      }

      expect(catchResult.success).toBe(true);
      expect(simulation.getState().creatures.caught['purrble']?.count).toBeGreaterThanOrEqual(1);

      // Effects container should have spawned floating text and sparkles
      expect(effectsManager.container.children.length).toBeGreaterThan(0);
    });

    it('uses treats as bait when available in simulation', () => {
      const simulation = new GameSimulation({ seed: 42 });
      simulation.addResource('treats', 5);
      expect(simulation.getState().currencies.treats).toBe(5);

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.1, simulation.getState());

      const wildSprite = manager.getWildCreatures()[0];
      manager.handleWildClick(wildSprite);

      // One treat was consumed as bait
      expect(simulation.getState().currencies.treats).toBe(4);
    });
  });

  // =========================================================================
  // 4. Feature 20: Creature Habitats & Assignments
  // =========================================================================
  describe('4. Feature 20: Creature Habitats & Assignments Display', () => {
    it('defines visual configurations for all 5 habitats', () => {
      expect(Object.keys(HABITAT_CONFIGS)).toHaveLength(5);
      expect(HABITAT_CONFIGS.habitat_porch.zoneId).toBe('zone_01_parlor');
      expect(HABITAT_CONFIGS.habitat_garden.zoneId).toBe('zone_02_kitchen_garden');
      expect(HABITAT_CONFIGS.habitat_pond.zoneId).toBe('zone_03_pond_courtyard');
      expect(HABITAT_CONFIGS.habitat_aviary.zoneId).toBe('zone_04_library_balcony');
      expect(HABITAT_CONFIGS.habitat_sanctuary.zoneId).toBe('zone_05_starlight_observatory');
    });

    it('displays assigned creatures in unlocked habitats', () => {
      const simulation = new GameSimulation({ seed: 42 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Catch and assign Purrble to porch
      simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      const wild = simulation.getState().creatures.wildActive[0];
      simulation.attemptCatchCreature(wild.id, false);

      // Verify Purrble is caught and assigned to porch
      expect(simulation.getState().creatures.caught['purrble']?.count).toBe(1);
      expect(simulation.getState().creatures.caught['purrble']?.assignedHabitat).toBe('habitat_porch');

      // Update manager
      manager.setUnlockedZones(simulation.getState().territory.unlockedZones);
      manager.update(0.1, simulation.getState());

      const habitatCreatures = manager.getHabitatCreatures('habitat_porch');
      expect(habitatCreatures).toHaveLength(1);
      expect(habitatCreatures[0].speciesId).toBe('purrble');
      expect(habitatCreatures[0].isWild).toBe(false);
    });

    it('emits boost sparkles periodically for assigned habitat creatures', () => {
      const simulation = new GameSimulation({ seed: 42 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Catch and assign Purrble to porch
      simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      const wild = simulation.getState().creatures.wildActive[0];
      simulation.attemptCatchCreature(wild.id, false);

      manager.setUnlockedZones(['zone_01_parlor']);
      manager.update(0.1, simulation.getState());

      const porchCreature = manager.getHabitatCreatures('habitat_porch')[0];
      expect(porchCreature).toBeDefined();

      // Force boost timer to trigger
      porchCreature.boostPulseTimer = 0.05;
      const initialParticles = effectsManager.container.children.length;

      manager.update(0.1, simulation.getState());
      expect(effectsManager.container.children.length).toBeGreaterThan(initialParticles);
    });

    it('supports friendly petting interaction when clicked in habitat', () => {
      const simulation = new GameSimulation({ seed: 42 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      const wild = simulation.getState().creatures.wildActive[0];
      simulation.attemptCatchCreature(wild.id, false);

      manager.setUnlockedZones(['zone_01_parlor']);
      manager.update(0.1, simulation.getState());

      const creature = manager.getHabitatCreatures('habitat_porch')[0];
      expect(creature).toBeDefined();

      const initialEffects = effectsManager.container.children.length;
      // Trigger click callback
      (creature as any).onClickCallback(creature);

      expect(effectsManager.container.children.length).toBeGreaterThan(initialEffects);
    });

    it('hides habitat creatures and decor when habitat zone is locked', () => {
      const simulation = new GameSimulation({ seed: 42 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Artificially assign Mooshrum to Garden
      const state = simulation.getState();
      state.creatures.caught['mooshrum'] = {
        count: 1,
        level: 1,
        assignedHabitat: 'habitat_garden',
        xp: 0,
      };

      // Zone 2 is locked initially
      manager.setUnlockedZones(['zone_01_parlor']);
      manager.update(0.1, state);

      // Should have 0 garden creatures since zone 2 is locked
      expect(manager.getHabitatCreatures('habitat_garden')).toHaveLength(0);

      // Now unlock zone 2
      manager.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden']);
      manager.update(0.1, state);

      // Now garden creatures appear!
      expect(manager.getHabitatCreatures('habitat_garden')).toHaveLength(1);
    });
  });
});
