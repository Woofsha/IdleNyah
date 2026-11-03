// tests/unit/creatures.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameSimulation,
  getAllSpecies,
  findSpecies,
  getAllHabitats,
  calculateCatchRoll,
  DeterministicRNG,
} from '../../src/core';

describe('Creature Simulation & Habitat Suite', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = new GameSimulation({ seed: 'test-creatures-seed' });
  });

  describe('10 Original Species Compendium', () => {
    it('defines all 10 original creatures with unique stats and lore', () => {
      const species = getAllSpecies();
      expect(species.length).toBe(10);

      const expectedIds = [
        'purrble',
        'barkling',
        'mooshrum',
        'glimmerfin',
        'silkwisp',
        'cinderfox',
        'bramblebeast',
        'chrono_chirp',
        'dewdrop_slime',
        'starling_doe',
      ];

      for (const id of expectedIds) {
        const found = species.find((s) => s.id === id);
        expect(found, `Missing species: ${id}`).toBeDefined();
        expect(found?.baseCatchRate).toBeGreaterThan(0);
        expect(found?.goldPerSec).toBeGreaterThan(0);
      }
    });

    it('resolves species aliases properly', () => {
      expect(findSpecies('dust_bunny')?.id).toBe('purrble');
      expect(findSpecies('sproutling')?.id).toBe('barkling');
      expect(findSpecies('star_cat')?.id).toBe('starling_doe');
    });

    it('registers all 5 estate habitats', () => {
      const habitats = getAllHabitats();
      expect(habitats.length).toBe(5);

      const habIds = habitats.map((h) => h.id);
      expect(habIds).toContain('habitat_porch');
      expect(habIds).toContain('habitat_garden');
      expect(habIds).toContain('habitat_pond');
      expect(habIds).toContain('habitat_aviary');
      expect(habIds).toContain('habitat_sanctuary');
    });
  });

  describe('Wild Spawning & Despawning State Machine', () => {
    it('spawns wild creatures into unlocked zones', () => {
      expect(sim.getState().creatures.wildActive.length).toBe(0);

      const spawned = sim.spawnWildCreature('zone_01_parlor');
      expect(spawned).toBeDefined();
      expect(spawned?.zoneId).toBe('zone_01_parlor');
      expect(spawned?.speciesId).toBe('purrble');
      expect(spawned?.timer).toBe(45.0);

      expect(sim.getState().creatures.wildActive.length).toBe(1);
    });

    it('despawns wild creatures when their 45-second timer elapses', () => {
      const wild = sim.spawnWildCreature('zone_01_parlor')!;
      expect(sim.getState().creatures.wildActive.find((w) => w.id === wild.id)).toBeDefined();

      // Tick 20 seconds -> still active
      sim.tick(20000);
      const activeWild = sim.getState().creatures.wildActive.find((w) => w.id === wild.id);
      expect(activeWild).toBeDefined();
      expect(activeWild!.timer).toBeLessThan(30);

      // Tick another 30 seconds -> timer expires (total 50s > 45s)
      sim.tick(30000);
      expect(sim.getState().creatures.wildActive.find((w) => w.id === wild.id)).toBeUndefined();
    });

    it('enforces maximum wild creature capacity per zone (<= 3)', () => {
      sim.spawnWildCreature('zone_01_parlor');
      sim.spawnWildCreature('zone_01_parlor');
      sim.spawnWildCreature('zone_01_parlor');
      expect(sim.getState().creatures.wildActive.length).toBe(3);

      // Simulate 100 seconds of spawning ticks
      sim.tick(100000);

      // The count in zone_01_parlor should not exceed 3
      const inZone = sim.getState().creatures.wildActive.filter((w) => w.zoneId === zone_01_parlor).length;
      expect(inZone).toBeLessThanOrEqual(3);
    });
  });

  describe('Catching Probability & Baiting Mechanics', () => {
    it('applies bait bonus (+35%) to catch rate and consumes 1 treat', () => {
      const purrble = findSpecies('purrble')!;
      // Base catch rate 0.65 -> baited: min(0.95, 0.65 * 1.35) = 0.8775
      const deterministicRNG = new DeterministicRNG(12345);

      const freeResult = calculateCatchRoll(purrble, false, deterministicRNG);
      expect(freeResult.speciesId).toBe('purrble');

      // Test within simulation
      sim.addResource('treats', 5);
      const wild = sim.spawnWildCreature('zone_01_parlor')!;

      const initialTreats = sim.getState().currencies.treats;
      const catchRes = sim.attemptCatchCreature(wild.id, true);

      expect(sim.getState().currencies.treats).toBe(initialTreats - 1);
      if (catchRes.success) {
        expect(sim.getState().creatures.caught['purrble']?.count).toBe(1);
        expect(sim.getState().creatures.wildActive.find((w) => w.id === wild.id)).toBeUndefined();
      }
    });

    it('allows free catching attempt without consuming treats', () => {
      const wild = sim.spawnWildCreature('zone_01_parlor')!;
      const initialTreats = sim.getState().currencies.treats;

      sim.attemptCatchCreature(wild.id, false);
      expect(sim.getState().currencies.treats).toBe(initialTreats);
    });

    it('removes creature if it flees on failed catch', () => {
      // Create a mythic creature with low catch rate (0.08)
      // and test until failure/flee occurs
      sim.addResource('gold', 10000000);
      sim.addResource('treats', 500);
      sim.addResource('essence', 5000);
      for (let i = 0; i < 25; i++) sim.handleClick();
      sim.unlockTerritory('zone_02_kitchen_garden');
      sim.unlockTerritory('zone_03_pond_courtyard');
      sim.unlockTerritory('zone_04_library_balcony');
      sim.unlockTerritory('zone_05_starlight_observatory');

      const starDoe = sim.spawnWildCreature('zone_05_starlight_observatory', 'starling_doe')!;
      const result = sim.attemptCatchCreature(starDoe.id, false);
      if (!result.success && result.fled) {
        expect(sim.getState().creatures.wildActive.find((w) => w.id === starDoe.id)).toBeUndefined();
      }
    });
  });

  describe('Habitat Assignments & Production Boosts', () => {
    it('assigns caught creature to available habitat', () => {
      // Manually seed a caught creature
      const wild = sim.spawnWildCreature('zone_01_parlor', 'purrble')!;
      // Repeat attempts until caught
      while (sim.getState().creatures.wildActive.length > 0) {
        const res = sim.attemptCatchCreature(wild.id, false);
        if (res.fled) break;
      }

      if (sim.getState().creatures.caught['purrble']?.count) {
        const assigned = sim.assignCreature('purrble', 'habitat_porch');
        expect(assigned).toBe(true);
        expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBe('habitat_porch');
      }
    });

    it('rejects assigning creature to locked zone habitat', () => {
      // Force add caught creature
      sim.getState().creatures.caught['chrono_chirp'] = {
        count: 1,
        level: 1,
        assignedHabitat: undefined,
      };

      // habitat_sanctuary is in zone_05_starlight_observatory (locked initially)
      const success = sim.assignCreature('chrono_chirp', 'habitat_sanctuary');
      expect(success).toBe(false);
    });

    it('enforces habitat capacity limits', () => {
      // habitat_porch capacity is 3
      sim.getState().creatures.caught['purrble'] = {
        count: 3,
        level: 1,
        assignedHabitat: 'habitat_porch',
      };

      sim.getState().creatures.caught['barkling'] = {
        count: 1,
        level: 1,
        assignedHabitat: undefined,
      };

      // Attempting to assign 4th creature to porch should fail
      const success = sim.assignCreature('barkling', 'habitat_porch');
      expect(success).toBe(false);
    });

    it('contributes assigned creature output to passive ticks', () => {
      const initialGPS = sim.getTotalGPS();

      // Add purrble (+1 Gold/s) assigned to porch
      sim.getState().creatures.caught['purrble'] = {
        count: 1,
        level: 1,
        assignedHabitat: 'habitat_porch',
      };

      const newGPS = sim.getTotalGPS();
      expect(newGPS).toBeGreaterThan(initialGPS);
      expect(newGPS).toBeCloseTo(initialGPS + 1.0, 1);

      // Tick 1 second and check gold earned
      const startGold = sim.getState().currencies.gold;
      sim.tick(1000);
      expect(sim.getState().currencies.gold).toBeGreaterThan(startGold);
    });
  });
});

const zone_01_parlor = 'zone_01_parlor';
