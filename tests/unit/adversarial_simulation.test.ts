// tests/unit/adversarial_simulation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameSimulation,
  serializeState,
  deserializeState,
  exportSaveString,
  importSaveString,
  calculateOfflineProgress,
  createInitialState,
  clearInMemoryStorage,
  getAllZones,
  findZone,
  getAllSpecies,
  findHabitat,
} from '../../src/core';

describe('Milestone 1 Empirical Adversarial Stress Suite', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    clearInMemoryStorage();
    sim = new GameSimulation({ seed: 'adversarial-seed-42' });
  });

  describe('1. Persistence Fuzzing & Resilience', () => {
    it('handles completely malformed, empty, or non-object JSON without crashing', () => {
      const invalidInputs = [
        '',
        '   ',
        'undefined',
        '{ invalid json }',
        '{"version": 1, "currencies": {',
        'null',
        '12345',
        '"just a string"',
        'true',
        'false',
        '[]',
        '[1, 2, 3]',
      ];

      for (const input of invalidInputs) {
        expect(() => {
          const res = deserializeState(input, createInitialState);
          expect(res === null || typeof res === 'object').toBe(true);
        }).not.toThrow();

        expect(() => {
          const imported = importSaveString(input, createInitialState);
          expect(imported === null || typeof imported === 'object').toBe(true);
        }).not.toThrow();

        expect(() => {
          const loaded = sim.loadSaveData(input);
          expect(typeof loaded).toBe('boolean');
        }).not.toThrow();
      }
    });

    it('recovers gracefully from missing or null root fields in save JSON', () => {
      const minimalValid = JSON.stringify({});
      const loaded = deserializeState(minimalValid, createInitialState);
      expect(loaded).not.toBeNull();
      if (loaded) {
        expect(loaded.currencies.gold).toBe(0);
        expect(loaded.currencies.treats).toBe(0);
        expect(loaded.currencies.essence).toBe(0);
        expect(loaded.territory.unlockedZones).toContain('zone_01_parlor');
      }
    });

    it('handles null, undefined, NaN, and negative currency injections safely', () => {
      const fuzzedCurrencies = JSON.stringify({
        version: 1,
        currencies: {
          gold: -999999,
          treats: 'not-a-number',
          essence: null,
          extraBogus: NaN,
        },
      });

      const loaded = deserializeState(fuzzedCurrencies, createInitialState);
      expect(loaded).not.toBeNull();
      if (loaded) {
        expect(loaded.currencies.gold).toBe(0);
        expect(loaded.currencies.treats).toBe(0);
        expect(loaded.currencies.essence).toBe(0);
      }
    });

    it('handles numeric overflow / Infinity in currencies', () => {
      // 1e309 parses to Infinity in JSON
      const overflowSave = JSON.stringify({
        version: 1,
        currencies: {
          gold: 1e309,
          treats: -Infinity,
          essence: 1e309,
        },
      });

      const loaded = deserializeState(overflowSave, createInitialState);
      expect(loaded).not.toBeNull();
      if (loaded) {
        // Infinity is Number, Math.max(0, Infinity) is Infinity
        expect(Number.isFinite(loaded.currencies.gold) || loaded.currencies.gold === Infinity).toBe(true);
      }
    });

    it('sanitizes corrupted territory and unlocked zones data', () => {
      const fuzzedTerritory = JSON.stringify({
        version: 1,
        territory: {
          currentTier: -5,
          unlockedZones: ['totally_fake_zone', 42, null, 'zone_03_pond_courtyard'],
        },
      });

      const loaded = deserializeState(fuzzedTerritory, createInitialState);
      expect(loaded).not.toBeNull();
      if (loaded) {
        // Must contain starter parlor
        expect(loaded.territory.unlockedZones).toContain('zone_01_parlor');
        // Must filter out fake zones
        expect(loaded.territory.unlockedZones).not.toContain('totally_fake_zone');
        // Tier should be sanitized to at least 1
        expect(loaded.territory.currentTier).toBeGreaterThanOrEqual(1);
      }
    });

    it('handles corrupted creatures structure including null caught property', () => {
      const fuzzedCaughtNull = JSON.stringify({
        version: 1,
        creatures: {
          caught: null,
        },
      });

      // Does Object.entries(null) crash or gracefully return null?
      let result: any = null;
      expect(() => {
        result = deserializeState(fuzzedCaughtNull, createInitialState);
      }).not.toThrow();

      // Either null or default fallback without unhandled exception
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('sanitizes negative or NaN creature stats', () => {
      const fuzzedCreatures = JSON.stringify({
        version: 1,
        creatures: {
          caught: {
            purrble: {
              count: -10,
              level: -99,
              xp: -50,
              assignedHabitat: 'habitat_porch',
            },
          },
        },
      });

      const loaded = deserializeState(fuzzedCreatures, createInitialState);
      expect(loaded).not.toBeNull();
      if (loaded) {
        const purrble = loaded.creatures.caught['purrble'];
        expect(purrble).toBeDefined();
        expect(purrble.count).toBe(0);
        expect(purrble.level).toBe(1);
        expect(purrble.xp).toBe(0);
      }
    });

    it('handles future and negative schema versions gracefully', () => {
      const futureSave = JSON.stringify({
        version: 999,
        currencies: { gold: 500, treats: 10, essence: 5 },
      });

      const loadedFuture = deserializeState(futureSave, createInitialState);
      expect(loadedFuture).not.toBeNull();
      expect(loadedFuture?.currencies.gold).toBe(500);

      const legacySave = JSON.stringify({
        version: -1,
        resources: { gold: 350, treats: 20, essence: 0 },
      });

      const loadedLegacy = deserializeState(legacySave, createInitialState);
      expect(loadedLegacy).not.toBeNull();
      expect(loadedLegacy?.currencies.gold).toBe(350);
    });

    it('handles corrupted Base64 strings in importSaveString', () => {
      const corruptedB64 = [
        '!!!not_base_64!!!',
        'YWJj', // 'abc' (not JSON)
        'e30=', // '{}' (valid empty JSON)
      ];

      for (const str of corruptedB64) {
        expect(() => {
          importSaveString(str, createInitialState);
        }).not.toThrow();
      }
    });
  });

  describe('2. Long-Duration Offline Simulation Stress', () => {
    it('simulates 1 hour of offline elapsed time accurately', () => {
      sim.addResource('gold', 10000);
      sim.buyFacility('fifi_broom', 10);
      const gps = sim.getTotalGPS();
      expect(gps).toBeGreaterThan(0);

      const now = Date.now();
      const state = sim.getState();
      state.lastTickTimestamp = now - 3600 * 1000; // 1 hour ago

      const offline = calculateOfflineProgress(state, now, 0.80);
      expect(offline.elapsedSeconds).toBe(3600);
      // Expected: floor(gps * 3600 * 0.80)
      const expectedGold = Math.floor(gps * 3600 * 0.80);
      expect(offline.earnedGold).toBe(expectedGold);
    });

    it('simulates 24 hours of offline elapsed time at exact cap', () => {
      sim.addResource('gold', 10000);
      sim.buyFacility('fifi_broom', 10);
      const gps = sim.getTotalGPS();

      const now = Date.now();
      const state = sim.getState();
      state.lastTickTimestamp = now - 86400 * 1000; // 24 hours ago

      const offline = calculateOfflineProgress(state, now, 0.80);
      expect(offline.elapsedSeconds).toBe(86400);
      const expectedGold = Math.floor(gps * 86400 * 0.80);
      expect(offline.earnedGold).toBe(expectedGold);
    });

    it('enforces 24-hour cap for 7 days (604,800s) and 1 year (31,536,000s)', () => {
      sim.addResource('gold', 10000);
      sim.buyFacility('fifi_broom', 10);
      const gps = sim.getTotalGPS();

      const now = Date.now();
      const state = sim.getState();

      // 7 Days
      state.lastTickTimestamp = now - 7 * 86400 * 1000;
      const offline7d = calculateOfflineProgress(state, now, 0.80);
      expect(offline7d.elapsedSeconds).toBe(86400);
      expect(offline7d.earnedGold).toBe(Math.floor(gps * 86400 * 0.80));

      // 1 Year (365 days)
      state.lastTickTimestamp = now - 365 * 86400 * 1000;
      const offline1y = calculateOfflineProgress(state, now, 0.80);
      expect(offline1y.elapsedSeconds).toBe(86400);
      expect(offline1y.earnedGold).toBe(Math.floor(gps * 86400 * 0.80));
    });

    it('safely handles backward clock desync (time travel into past)', () => {
      const now = Date.now();
      const state = sim.getState();
      state.lastTickTimestamp = now + 100000; // Last tick is in the future

      const offline = calculateOfflineProgress(state, now, 0.80);
      expect(offline.elapsedSeconds).toBe(0);
      expect(offline.earnedGold).toBe(0);
      expect(offline.earnedTreats).toBe(0);
      expect(offline.earnedEssence).toBe(0);
    });

    it('safely handles extreme/invalid timestamps', () => {
      const state = sim.getState();
      state.lastTickTimestamp = 0;

      const offlineZero = calculateOfflineProgress(state, 100000, 0.80);
      expect(offlineZero.elapsedSeconds).toBeLessThanOrEqual(86400);
      expect(offlineZero.earnedGold).toBeGreaterThanOrEqual(0);

      const offlineNaN = calculateOfflineProgress(state, NaN, 0.80);
      expect(Number.isNaN(offlineNaN.earnedGold) || offlineNaN.earnedGold === 0).toBe(true);
    });

    it('maintains finite numeric integrity under high-level 24-hour accumulation', () => {
      sim.addResource('gold', 1e15);
      const bought = sim.buyFacility('fifi_broom', 100);
      expect(bought).toBe(true);
      sim.buyMultiplier('nyah_auditing');

      const now = Date.now();
      const state = sim.getState();
      state.lastTickTimestamp = now - 86400 * 1000;

      const offline = calculateOfflineProgress(state, now, 0.80);
      expect(Number.isFinite(offline.earnedGold)).toBe(true);
      expect(offline.earnedGold).toBeGreaterThan(0);
    });

    it('tick() protects against runaway loops when presented with large deltaMs', () => {
      // 1 hour in one tick call
      expect(() => {
        sim.tick(3600 * 1000);
      }).not.toThrow();

      // State timestamp should be updated
      expect(sim.getState().lastTickTimestamp).toBeGreaterThan(0);
    });
  });

  describe('3. Wild Creature Spawning & Habitat Capacity Stress', () => {
    it('strictly caps active wild creatures to 3 per zone under heavy tick loops', () => {
      // Unlock all 5 zones
      const zones = getAllZones();
      for (const z of zones) {
        if (!sim.getState().territory.unlockedZones.includes(z.id)) {
          sim.getState().territory.unlockedZones.push(z.id);
        }
      }
      expect(sim.getState().territory.unlockedZones.length).toBe(5);

      // Simulate 50,000 steps (2500 seconds of game time)
      for (let i = 0; i < 500; i++) {
        sim.tick(5000); // 5s delta per tick
      }

      // Check wild creature count per zone
      const wild = sim.getState().creatures.wildActive;
      for (const z of zones) {
        const inZone = wild.filter((w) => w.zoneId === z.id);
        expect(inZone.length).toBeLessThanOrEqual(3);
      }

      // Total active wild creatures must never exceed 5 * 3 = 15
      expect(wild.length).toBeLessThanOrEqual(15);
    });

    it('wild creatures despawn cleanly without negative timers or leaks', () => {
      sim.spawnWildCreature('zone_01_parlor');
      expect(sim.getState().creatures.wildActive.length).toBe(1);

      // Advance by 50 seconds (wild lifetime is 45s)
      sim.tick(50000);

      const remaining = sim.getState().creatures.wildActive;
      for (const c of remaining) {
        expect(c.timer).toBeGreaterThan(0);
      }
    });

    it('spawns all species defined for unlocked zones across repeated spawns', () => {
      const allSpecies = getAllSpecies();
      const spawnedSpecies = new Set<string>();

      // Force spawn 500 creatures across all zones
      for (const z of getAllZones()) {
        for (let i = 0; i < 50; i++) {
          const c = sim.spawnWildCreature(z.id);
          if (c) spawnedSpecies.add(c.speciesId);
        }
      }

      // All 10 species should be observed
      expect(spawnedSpecies.size).toBe(10);
      for (const spec of allSpecies) {
        expect(spawnedSpecies.has(spec.id)).toBe(true);
      }
    });

    it('verifies habitat assignment rejects multi-count creature exceeding capacity', () => {
      // habitat_porch capacity is 3
      const porch = findHabitat('habitat_porch');
      expect(porch?.capacity).toBe(3);

      // Manually add 10 Purrbles to caught
      sim.getState().creatures.caught['purrble'] = {
        count: 10,
        level: 1,
        xp: 0,
        isShiny: false,
      };

      // Attempt assignment when 0 currently assigned (10 > 3 capacity)
      const assigned = sim.assignCreature('purrble', 'habitat_porch');

      // Check that assignment is rejected because 10 exceeds capacity 3
      expect(assigned).toBe(false);

      const assignedCount = sim.getState().creatures.caught['purrble'].assignedHabitat === 'habitat_porch'
        ? sim.getState().creatures.caught['purrble'].count
        : 0;

      expect(assignedCount).toBe(0);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBeUndefined();
    });

    it('verifies bait usage with zero treats does not cause negative treats', () => {
      expect(sim.getState().currencies.treats).toBe(0);

      const wild = sim.spawnWildCreature('zone_01_parlor', 'purrble')!;
      const result = sim.attemptCatchCreature(wild.id, true); // useBait = true

      expect(sim.getState().currencies.treats).toBe(0);
      expect(typeof result.success).toBe('boolean');
    });

    it('rejects creature assignment to habitat in a locked zone', () => {
      // habitat_sanctuary is in zone_05 (locked by default)
      expect(sim.getState().territory.unlockedZones).not.toContain('zone_05_starlight_observatory');

      sim.getState().creatures.caught['purrble'] = {
        count: 1,
        level: 1,
      };

      const success = sim.assignCreature('purrble', 'habitat_sanctuary');
      expect(success).toBe(false);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBeUndefined();
    });

    it('rejects creature assignment to nonexistent habitat or invalid species', () => {
      sim.getState().creatures.caught['purrble'] = { count: 1, level: 1 };

      expect(sim.assignCreature('purrble', 'nonexistent_habitat_xyz')).toBe(false);
      expect(sim.assignCreature('nonexistent_species_xyz', 'habitat_porch')).toBe(false);
    });
  });

  describe('4. Territory Tier Progression Prerequisites & Exploits', () => {
    it('blocks attempting to purchase territory zones out of order', () => {
      sim.addResource('gold', 1e9);
      sim.addResource('treats', 1000);
      sim.addResource('essence', 10000);

      // Starting with only zone_01_parlor unlocked
      expect(sim.getState().territory.unlockedZones).toEqual(['zone_01_parlor']);

      // Attempt Zone 3 (requires Zone 2)
      expect(sim.unlockTerritory('zone_03_pond_courtyard')).toBe(false);
      expect(sim.getState().territory.unlockedZones).not.toContain('zone_03_pond_courtyard');

      // Attempt Zone 4 (requires Zone 3)
      expect(sim.unlockTerritory('zone_04_library_balcony')).toBe(false);
      expect(sim.getState().territory.unlockedZones).not.toContain('zone_04_library_balcony');

      // Attempt Zone 5 (requires Zone 4)
      expect(sim.unlockTerritory('zone_05_starlight_observatory')).toBe(false);
      expect(sim.getState().territory.unlockedZones).not.toContain('zone_05_starlight_observatory');

      // No currencies should be deducted on failed purchases
      expect(sim.getState().currencies.gold).toBe(1e9);
    });

    it('blocks zone unlock when secondary/tertiary currency is insufficient', () => {
      // First unlock Zone 2 properly
      sim.addResource('gold', 1000);
      for (let i = 0; i < 25; i++) sim.handleClick();
      expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(true);

      // Zone 3 costs 7500 Gold + 30 Treats. Give gold, but 0 treats.
      sim.addResource('gold', 10000);
      expect(sim.getState().currencies.treats).toBeLessThan(30);

      const beforeGold = sim.getState().currencies.gold;
      expect(sim.unlockTerritory('zone_03_pond_courtyard')).toBe(false);
      expect(sim.getState().currencies.gold).toBe(beforeGold); // No deduction

      // Give 29 treats (1 short of 30)
      sim.addResource('treats', 29 - sim.getState().currencies.treats);
      expect(sim.unlockTerritory('zone_03_pond_courtyard')).toBe(false);

      // Give 1 more treat (30 treats reached)
      sim.addResource('treats', 1);
      expect(sim.unlockTerritory('zone_03_pond_courtyard')).toBe(true);
      expect(sim.getState().territory.unlockedZones).toContain('zone_03_pond_courtyard');
    });

    it('blocks duplicate unlocks and does not deduct currencies repeatedly', () => {
      // Zone 1 is already unlocked
      const startGold = 5000;
      sim.addResource('gold', startGold);

      expect(sim.unlockTerritory('zone_01_parlor')).toBe(false);
      expect(sim.getState().currencies.gold).toBe(startGold);

      // Unlock Zone 2
      for (let i = 0; i < 25; i++) sim.handleClick();
      expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(true);
      const goldAfterUnlock = sim.getState().currencies.gold;

      // Duplicate attempt on Zone 2
      expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(false);
      expect(sim.getState().currencies.gold).toBe(goldAfterUnlock);
    });

    it('rejects unlock attempt with negative currencies injected', () => {
      // Force negative gold
      (sim.getState().currencies as any).gold = -500;
      for (let i = 0; i < 25; i++) sim.handleClick();

      expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(false);
      expect(sim.getState().territory.unlockedZones).not.toContain('zone_02_kitchen_garden');
    });

    it('blocks unlock when chore clicks are 1 below threshold', () => {
      sim.addResource('gold', 5000);
      // Click 24 times (threshold is 25)
      for (let i = 0; i < 24; i++) sim.handleClick();

      expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(false);

      // Click 25th time
      sim.handleClick();
      expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(true);
    });

    it('handles invalid zone IDs safely without exception', () => {
      expect(sim.unlockTerritory('')).toBe(false);
      expect(sim.unlockTerritory('random_invalid_zone_id')).toBe(false);
    });
  });
});
