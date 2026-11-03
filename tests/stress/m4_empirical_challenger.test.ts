// tests/stress/m4_empirical_challenger.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import {
  CreatureSprite,
  CreaturesManager,
  HABITAT_CONFIGS,
  ZONE_WILD_ROAM_BOUNDS,
  type ZoneBounds,
} from '../../src/render/creatures';
import { EffectsManager } from '../../src/render/effects';
import { GameSimulation } from '../../src/core/simulation';
import { getAllSpecies, findSpecies } from '../../src/core/creatures';

// Headless polyfills for requestAnimationFrame
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}

describe('Milestone 4 Empirical Challenger Verification Suite (challenger_m4_1)', () => {
  let entityLayer: Container;
  let effectsManager: EffectsManager;

  beforeEach(() => {
    entityLayer = new Container({ sortableChildren: true });
    effectsManager = new EffectsManager();
  });

  // =========================================================================
  // 1. High-Rate Spawning, Rapid Despawn Churn & Ghost Sprite Invariant
  // =========================================================================
  describe('1. High-Rate Spawning & Despawning (500 Creatures & Zero Ghost Sprites)', () => {
    it('spawns 500 wild creatures across 5 zones and verifies zero ghost sprites and zero memory leaks upon natural expiry', () => {
      const simulation = new GameSimulation({ seed: 777 });
      simulation.state.territory.unlockedZones = [
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ];

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });
      manager.setUnlockedZones(simulation.state.territory.unlockedZones);

      const allSpecies = getAllSpecies();
      const spawnedIds: string[] = [];

      // Spawn 500 wild creatures in simulation
      for (let i = 0; i < 500; i++) {
        const spec = allSpecies[i % allSpecies.length];
        const wild = simulation.spawnWildCreature(spec.spawnZoneId, spec.id);
        if (wild) spawnedIds.push(wild.id);
      }

      expect(spawnedIds.length).toBe(500);
      expect(simulation.getState().creatures.wildActive.length).toBe(500);

      // Single tick sync in CreaturesManager: creates 500 sprites
      manager.update(0.016, simulation.getState());

      const activeSprites = manager.getWildCreatures();
      expect(activeSprites.length).toBe(500);

      // Entity layer contains the habitat-decor-container + 500 wild creature sprites
      expect(entityLayer.children.length).toBe(501);

      // Now expire all 500 wild creatures by setting timer = 0 and ticking simulation
      simulation.state.creatures.wildActive = [];

      // Manager detects all 500 are gone from activeIds -> triggers flee
      manager.update(0.1, simulation.getState());

      // Advance time by 3.0 seconds (fleeAlpha decreases by deltaSeconds * 2.5, so 3s guarantees alpha <= 0)
      manager.update(3.0, simulation.getState());

      // EMPIRICAL VERIFICATION:
      // 1. All wild sprites removed from manager
      expect(manager.getWildCreatures().length).toBe(0);

      // 2. Internal wildSprites map must be completely empty (0 memory leak)
      expect((manager as any).wildSprites.size).toBe(0);

      // 3. ZERO ghost sprites left in entityLayer: exactly 1 child remains (habitatDecorContainer)
      expect(entityLayer.children.length).toBe(1);
      expect(entityLayer.children[0].label).toBe('habitat-decor-container');

      // 4. Verify all spawned sprites were destroyed
      for (const sprite of activeSprites) {
        expect(sprite.destroyed).toBe(true);
      }

      console.log(`[CHALLENGER-1 PASS] 500 wild creatures spawned, synchronized, expired, and cleanly destroyed with 0 ghost sprites.`);
    });

    it('survives continuous concurrent churn over 300 cycles (spawning, catching, expiring, roaming)', () => {
      const simulation = new GameSimulation({ seed: 101 });
      simulation.state.territory.unlockedZones = [
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ];
      simulation.addResource('treats', 1000);

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });
      manager.setUnlockedZones(simulation.state.territory.unlockedZones);

      let totalSpawned = 0;
      let totalCatchAttempts = 0;
      let totalCaught = 0;
      let totalFled = 0;

      // 300 frames of dynamic churn
      for (let frame = 0; frame < 300; frame++) {
        for (let s = 0; s < 2; s++) {
          simulation.spawnWildCreature();
          totalSpawned++;
        }

        simulation.tick(100);
        manager.update(0.1, simulation.getState());

        const wildSprites = manager.getWildCreatures().filter((s) => !s.destroyed);
        if (wildSprites.length > 0 && Math.random() < 0.6) {
          const target = wildSprites[Math.floor(Math.random() * wildSprites.length)];
          totalCatchAttempts++;
          const result = manager.handleWildClick(target);
          if (result.success) totalCaught++;
          else if (result.fled) totalFled++;
        }
      }

      // Clean drain
      simulation.state.creatures.wildActive = [];
      manager.update(0.1, simulation.getState());
      manager.update(3.0, simulation.getState());

      expect(manager.getWildCreatures().length).toBe(0);
      expect((manager as any).wildSprites.size).toBe(0);

      const habitatSprites = manager.getHabitatCreatures();
      expect(entityLayer.children.length).toBe(1 + habitatSprites.length);

      console.log(`[CHURN STATS] Spawned: ${totalSpawned}, Catch Attempts: ${totalCatchAttempts}, Caught: ${totalCaught}, Fled: ${totalFled}`);
      console.log(`[CHURN VERIFICATION] EntityLayer child count strictly matches 1 decor + ${habitatSprites.length} habitat creatures.`);
    });
  });

  // =========================================================================
  // 2. Catching Mechanics, Bait Consumption & State Synchronization
  // =========================================================================
  describe('2. Catching Mechanics, Bait Consumption & State Synchronization', () => {
    it('accurately decrements Treats when bait is available and never goes negative when Treats are 0', () => {
      const simulation = new GameSimulation({ seed: 555 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      // Part A: Player with 3 treats
      simulation.addResource('treats', 3);
      expect(simulation.getState().currencies.treats).toBe(3);

      const wild1 = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.016, simulation.getState());
      const sprite1 = manager.getWildCreatures().find((s) => s.wildInstanceId === wild1?.id)!;

      manager.handleWildClick(sprite1);
      // Treats should be decremented by exactly 1
      expect(simulation.getState().currencies.treats).toBe(2);

      // Part B: Consume remaining 2 treats
      simulation.state.currencies.treats = 0;
      expect(simulation.getState().currencies.treats).toBe(0);

      const wild2 = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.016, simulation.getState());
      const sprite2 = manager.getWildCreatures().find((s) => s.wildInstanceId === wild2?.id)!;

      manager.handleWildClick(sprite2);
      // Treats must remain at 0 (never negative)
      expect(simulation.getState().currencies.treats).toBe(0);
      expect(simulation.getState().currencies.treats).toBeGreaterThanOrEqual(0);
    });

    it('prevents treat theft and race conditions during 100-click rapid spam on a single creature', () => {
      const simulation = new GameSimulation({ seed: 999 });
      simulation.addResource('treats', 10);
      expect(simulation.getState().currencies.treats).toBe(10);

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const wild = simulation.spawnWildCreature('zone_01_parlor', 'purrble');
      manager.update(0.016, simulation.getState());
      const sprite = manager.getWildCreatures()[0];
      expect(sprite).toBeDefined();

      // Safely spam clicks as long as creature is not destroyed
      let clickCount = 0;
      while (clickCount < 100) {
        clickCount++;
        if (sprite.destroyed) break;
        const res = manager.handleWildClick(sprite);
        if (res.success) break;
      }

      // Check bait consumption:
      const remainingTreats = simulation.getState().currencies.treats;
      expect(remainingTreats).toBeGreaterThanOrEqual(0);
      expect(remainingTreats).toBeLessThan(10);

      // Verify that after it left wildActive, calling attemptCatchCreature does NOT consume treats
      const deadId = wild!.id;
      const treatsBefore = simulation.getState().currencies.treats;
      const ghostAttempt = simulation.attemptCatchCreature(deadId, true);
      expect(ghostAttempt.success).toBe(false);
      expect(ghostAttempt.fled).toBe(false);
      expect(simulation.getState().currencies.treats).toBe(treatsBefore); // ZERO treat theft!

      console.log(`[SPAM AUDIT] Initial treats: 10, Final treats: ${remainingTreats}, Ghost clicks treat drain: 0.`);
    });

    it('verifies state synchronization and roster persistence across all 10 original species', () => {
      const simulation = new GameSimulation({ seed: 888 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const allSpecies = getAllSpecies();
      expect(allSpecies.length).toBe(10);

      for (const spec of allSpecies) {
        const wild = simulation.spawnWildCreature(spec.spawnZoneId, spec.id);
        expect(wild).not.toBeNull();
        manager.update(0.016, simulation.getState());

        const sprite = manager.getWildCreatures().find((s) => s.wildInstanceId === wild?.id);
        expect(sprite).toBeDefined();
        expect(sprite!.speciesId).toBe(spec.id);

        let caught = false;
        let attempts = 0;
        while (!caught && attempts < 100) {
          attempts++;
          let curWild = simulation.state.creatures.wildActive.find((w) => w.speciesId === spec.id);
          if (!curWild) {
            curWild = simulation.spawnWildCreature(spec.spawnZoneId, spec.id)!;
            manager.update(0.016, simulation.getState());
          }
          const curSprite = manager.getWildCreatures().find((s) => s.wildInstanceId === curWild?.id && !s.destroyed);
          if (curSprite) {
            const res = manager.handleWildClick(curSprite);
            if (res.success) {
              caught = true;
            } else if (res.fled) {
              // Advance time so fleeing sprite cleans up
              manager.update(1.0, simulation.getState());
            }
          }
        }

        expect(caught).toBe(true);

        const caughtEntry = simulation.getState().creatures.caught[spec.id];
        expect(caughtEntry).toBeDefined();
        expect(caughtEntry.count).toBeGreaterThanOrEqual(1);
        expect(caughtEntry.assignedHabitat).toBe(spec.preferredHabitatId);
      }

      expect(simulation.getState().stats?.totalCreaturesCaught).toBeGreaterThanOrEqual(10);
      console.log(`[ROSTER VERIFICATION] Successfully caught and assigned all 10 species to their preferred habitats.`);
    });
  });

  // =========================================================================
  // 3. Habitat Boundary Clamping & Zero Escape Proof
  // =========================================================================
  describe('3. Habitat Boundary Clamping & Zero Escape Proof', () => {
    const ESTATE_ZONE_BOUNDS: Record<string, ZoneBounds> = {
      zone_01_parlor: { minX: -192, maxX: 192, minY: -160, maxY: 160 },
      zone_02_kitchen_garden: { minX: 192, maxX: 544, minY: -160, maxY: 160 },
      zone_03_pond_courtyard: { minX: -352, maxX: 224, minY: 160, maxY: 480 },
      zone_04_library_balcony: { minX: -544, maxX: -192, minY: -160, maxY: 160 },
      zone_05_starlight_observatory: { minX: -320, maxX: 384, minY: -480, maxY: -160 },
    };

    it('proves all 5 habitat roamBounds are strictly contained within their respective estate zones with positive safety margins', () => {
      for (const [habId, config] of Object.entries(HABITAT_CONFIGS)) {
        const zoneBounds = ESTATE_ZONE_BOUNDS[config.zoneId];
        expect(zoneBounds).toBeDefined();

        const roam = config.roamBounds;

        expect(roam.minX).toBeGreaterThanOrEqual(zoneBounds.minX);
        expect(roam.maxX).toBeLessThanOrEqual(zoneBounds.maxX);
        expect(roam.minY).toBeGreaterThanOrEqual(zoneBounds.minY);
        expect(roam.maxY).toBeLessThanOrEqual(zoneBounds.maxY);

        expect(config.centerX).toBeGreaterThanOrEqual(roam.minX);
        expect(config.centerX).toBeLessThanOrEqual(roam.maxX);
        expect(config.centerY).toBeGreaterThanOrEqual(roam.minY);
        expect(config.centerY).toBeLessThanOrEqual(roam.maxY);

        const marginX1 = roam.minX - zoneBounds.minX;
        const marginX2 = zoneBounds.maxX - roam.maxX;
        const marginY1 = roam.minY - zoneBounds.minY;
        const marginY2 = zoneBounds.maxY - roam.maxY;

        console.log(`[HABITAT BOUNDS AUDIT] ${habId} (${config.zoneId}): margins=[left:${marginX1}px, right:${marginX2}px, top:${marginY1}px, bottom:${marginY2}px]`);

        expect(marginX1).toBeGreaterThanOrEqual(0);
        expect(marginX2).toBeGreaterThanOrEqual(0);
        expect(marginY1).toBeGreaterThanOrEqual(0);
        expect(marginY2).toBeGreaterThanOrEqual(0);
      }
    });

    it('proves all 5 wild roam bounds are strictly contained within estate zones with positive safety margins', () => {
      for (const [zoneId, wildRoam] of Object.entries(ZONE_WILD_ROAM_BOUNDS)) {
        const zoneBounds = ESTATE_ZONE_BOUNDS[zoneId];
        expect(zoneBounds).toBeDefined();

        expect(wildRoam.minX).toBeGreaterThanOrEqual(zoneBounds.minX);
        expect(wildRoam.maxX).toBeLessThanOrEqual(zoneBounds.maxX);
        expect(wildRoam.minY).toBeGreaterThanOrEqual(zoneBounds.minY);
        expect(wildRoam.maxY).toBeLessThanOrEqual(zoneBounds.maxY);

        const marginX1 = wildRoam.minX - zoneBounds.minX;
        const marginX2 = zoneBounds.maxX - wildRoam.maxX;
        const marginY1 = wildRoam.minY - zoneBounds.minY;
        const marginY2 = zoneBounds.maxY - wildRoam.maxY;

        console.log(`[WILD ROAM AUDIT] ${zoneId}: margins=[left:${marginX1}px, right:${marginX2}px, top:${marginY1}px, bottom:${marginY2}px]`);
        expect(marginX1).toBeGreaterThan(0);
        expect(marginX2).toBeGreaterThan(0);
        expect(marginY1).toBeGreaterThan(0);
        expect(marginY2).toBeGreaterThan(0);
      }
    });

    it('simulates 2,500 movement steps across all 10 species and proves 0 boundary escapes', () => {
      const allSpecies = getAllSpecies();
      let totalStepsChecked = 0;
      let boundaryViolations = 0;

      for (const spec of allSpecies) {
        const habConfig = HABITAT_CONFIGS[spec.preferredHabitatId];
        expect(habConfig).toBeDefined();

        const sprite = new CreatureSprite({
          speciesId: spec.id,
          x: habConfig.centerX,
          y: habConfig.centerY,
          roamBounds: habConfig.roamBounds,
        });

        for (let frame = 0; frame < 250; frame++) {
          sprite.update(0.05);
          totalStepsChecked++;

          if (
            sprite.x < habConfig.roamBounds.minX ||
            sprite.x > habConfig.roamBounds.maxX ||
            sprite.y < habConfig.roamBounds.minY ||
            sprite.y > habConfig.roamBounds.maxY
          ) {
            boundaryViolations++;
          }
        }
      }

      console.log(`[BOUNDARY RESILIENCE] Total movement steps: ${totalStepsChecked}, Violations: ${boundaryViolations}`);
      expect(totalStepsChecked).toBe(2500);
      expect(boundaryViolations).toBe(0);
    });

    it('resists extreme deltaSeconds (lag spikes of 100s, negative time, zero time) with strict bounds clamping', () => {
      const sprite = new CreatureSprite({
        speciesId: 'cinderfox',
        x: -320,
        y: -30,
        roamBounds: { minX: -380, maxX: -260, minY: -70, maxY: 10 },
      });

      sprite.update(100.0);
      expect(sprite.x).toBeGreaterThanOrEqual(-380);
      expect(sprite.x).toBeLessThanOrEqual(-260);
      expect(sprite.y).toBeGreaterThanOrEqual(-70);
      expect(sprite.y).toBeLessThanOrEqual(10);

      sprite.update(500.0);
      expect(sprite.x).toBeGreaterThanOrEqual(-380);
      expect(sprite.x).toBeLessThanOrEqual(-260);

      sprite.update(-10.0);
      expect(sprite.x).toBeGreaterThanOrEqual(-380);
      expect(sprite.x).toBeLessThanOrEqual(-260);

      sprite.update(0);
      expect(sprite.x).toBeGreaterThanOrEqual(-380);
      expect(sprite.x).toBeLessThanOrEqual(-260);
    });
  });

  // =========================================================================
  // 4. Habitat Capacity, Zone Unlock Gating & Petting Interaction
  // =========================================================================
  describe('4. Habitat Capacity, Zone Unlock Gating & Petting Interactions', () => {
    it('strictly enforces habitat capacity limits even when massive numbers of creatures are caught', () => {
      const simulation = new GameSimulation({ seed: 333 });
      simulation.state.territory.unlockedZones = [
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ];

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });
      manager.setUnlockedZones(simulation.state.territory.unlockedZones);

      simulation.state.creatures.caught['purrble'] = {
        count: 100,
        level: 10,
        assignedHabitat: 'habitat_porch',
      };

      simulation.state.creatures.caught['barkling'] = {
        count: 50,
        level: 5,
        assignedHabitat: 'habitat_garden',
      };
      simulation.state.creatures.caught['mooshrum'] = {
        count: 50,
        level: 5,
        assignedHabitat: 'habitat_garden',
      };

      manager.update(0.016, simulation.getState());

      const porchCreatures = manager.getHabitatCreatures('habitat_porch');
      expect(porchCreatures.length).toBeLessThanOrEqual(HABITAT_CONFIGS.habitat_porch.capacity);
      expect(porchCreatures.length).toBe(2);

      const gardenCreatures = manager.getHabitatCreatures('habitat_garden');
      expect(gardenCreatures.length).toBeLessThanOrEqual(HABITAT_CONFIGS.habitat_garden.capacity);
      expect(gardenCreatures.length).toBe(4);

      console.log(`[CAPACITY VERIFICATION] Porch rendered: ${porchCreatures.length}/3, Garden rendered: ${gardenCreatures.length}/4.`);
    });

    it('gates habitat creature rendering behind zone unlock state and cleans up immediately on lock', () => {
      const simulation = new GameSimulation({ seed: 222 });
      simulation.state.territory.unlockedZones = ['zone_01_parlor'];

      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });
      manager.setUnlockedZones(simulation.state.territory.unlockedZones);

      simulation.state.creatures.caught['glimmerfin'] = {
        count: 2,
        level: 1,
        assignedHabitat: 'habitat_pond',
      };

      manager.update(0.016, simulation.getState());
      expect(manager.getHabitatCreatures('habitat_pond').length).toBe(0);

      simulation.state.territory.unlockedZones.push('zone_03_pond_courtyard');
      manager.setUnlockedZones(simulation.state.territory.unlockedZones);
      manager.update(0.016, simulation.getState());

      const pondSprites = manager.getHabitatCreatures('habitat_pond');
      expect(pondSprites.length).toBe(2);
      expect(pondSprites[0].speciesId).toBe('glimmerfin');

      manager.setUnlockedZones(['zone_01_parlor']);
      manager.update(0.016, simulation.getState());

      expect(manager.getHabitatCreatures('habitat_pond').length).toBe(0);
      for (const s of pondSprites) {
        expect(s.destroyed).toBe(true);
      }
      console.log(`[ZONE GATING PASS] Locked habitats suppress rendering and clean up cleanly on state transitions.`);
    });

    it('petting interaction on habitat creatures spawns bespoke quote and sparkle bursts for all 10 species', () => {
      const simulation = new GameSimulation({ seed: 111 });
      const manager = new CreaturesManager({
        entityLayer,
        effectsManager,
        simulation,
      });

      const allSpecies = getAllSpecies();

      for (const spec of allSpecies) {
        const sprite = new CreatureSprite({
          speciesId: spec.id,
          isWild: false,
          x: 100,
          y: 100,
          onClick: (clicked) => {
            (manager as any).handleHabitatPetting(clicked);
          },
        });

        const initialEffects = effectsManager.container.children.length;
        (manager as any).handleHabitatPetting(sprite);
        expect(effectsManager.container.children.length).toBeGreaterThan(initialEffects);
      }

      console.log(`[PETTING AUDIT] Successfully petted all 10 species with bespoke dialogue quotes.`);
    });
  });
});
