// tests/unit/persistence.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameSimulation,
  serializeState,
  deserializeState,
  exportSaveString,
  importSaveString,
  calculateOfflineProgress,
  saveToLocalStorage,
  loadFromLocalStorage,
  clearInMemoryStorage,
  createInitialState,
} from '../../src/core';

describe('Persistence & Offline Progress Suite', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    clearInMemoryStorage();
    sim = new GameSimulation({ seed: 'test-persistence-seed' });
  });

  describe('Serialization & Save Schema v1', () => {
    it('serializes state into valid JSON matching version 1 schema', () => {
      sim.addResource('gold', 1234);
      sim.addResource('treats', 56);
      sim.addResource('essence', 78);
      const cost = sim.getUpgradeCost('fifi_broom', 5);
      sim.buyFacility('fifi_broom', 5);

      const json = sim.getSaveData();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.timestamp).toBeGreaterThan(0);
      expect(parsed.currencies.gold).toBe(1234 - cost);
      expect(parsed.currencies.treats).toBe(56);
      expect(parsed.currencies.essence).toBe(78);
      expect(parsed.facilities['fifi_broom']?.level).toBe(5);
      expect(parsed.territory.unlockedZones).toContain('zone_01_parlor');
    });

    it('roundtrips serialize and deserialize without loss of data', () => {
      sim.addResource('gold', 100000);
      sim.addResource('treats', 200);
      sim.addResource('essence', 500);
      sim.buyFacility('fifi_broom', 10);
      sim.buyFacility('fifi_duster', 3);
      sim.buyMultiplier('nyah_supervision');

      // Add a caught creature
      sim.getState().creatures.caught['purrble'] = {
        count: 2,
        level: 3,
        assignedHabitat: 'habitat_porch',
        xp: 40,
        isShiny: true,
      };

      const json = serializeState(sim.getState());
      const restored = deserializeState(json, createInitialState);

      expect(restored).not.toBeNull();
      expect(restored?.currencies.gold).toBe(sim.getState().currencies.gold);
      expect(restored?.currencies.treats).toBe(sim.getState().currencies.treats);
      expect(restored?.currencies.essence).toBe(sim.getState().currencies.essence);
      expect(restored?.facilities['fifi_broom']?.level).toBe(10);
      expect(restored?.facilities['fifi_duster']?.level).toBe(3);
      expect(restored?.multipliers['nyah_supervision']?.level).toBe(1);
      expect(restored?.creatures.caught['purrble']?.count).toBe(2);
      expect(restored?.creatures.caught['purrble']?.level).toBe(3);
      expect(restored?.creatures.caught['purrble']?.isShiny).toBe(true);
    });

    it('supports export and import via base64 encoded strings', () => {
      sim.addResource('gold', 5555);
      const encoded = exportSaveString(sim.getState());
      expect(typeof encoded).toBe('string');

      const imported = importSaveString(encoded, createInitialState);
      expect(imported).not.toBeNull();
      expect(imported?.currencies.gold).toBe(5555);
    });

    it('gracefully handles corrupted JSON input with null fallback', () => {
      const corrupt = '{ "version": 1, "currencies": broken json! ';
      const result = deserializeState(corrupt, createInitialState);
      expect(result).toBeNull();

      const importResult = importSaveString('invalid-not-json-or-base64', createInitialState);
      expect(importResult).toBeNull();
    });

    it('migrates legacy v0 save schemas with resources alias', () => {
      const legacySave = JSON.stringify({
        version: 0,
        timestamp: Date.now() - 5000,
        resources: {
          gold: 999,
          treats: 44,
          essence: 11,
        },
        facilities: {
          fifi_broom: { level: 2 },
        },
      });

      const migrated = deserializeState(legacySave, createInitialState);
      expect(migrated).not.toBeNull();
      expect(migrated?.currencies.gold).toBe(999);
      expect(migrated?.currencies.treats).toBe(44);
      expect(migrated?.currencies.essence).toBe(11);
      expect(migrated?.facilities['fifi_broom']?.level).toBe(2);
    });
  });

  describe('LocalStorage Persistence Adapter', () => {
    it('saves and loads cleanly via LocalStorage adapter', () => {
      sim.addResource('gold', 7777);
      const saved = saveToLocalStorage(sim.getState(), 'test_slot');
      expect(saved).toBe(true);

      const loaded = loadFromLocalStorage(createInitialState, 'test_slot');
      expect(loaded).not.toBeNull();
      expect(loaded?.currencies.gold).toBe(7777);
    });
  });

  describe('Offline Progress Calculation', () => {
    it('calculates offline earnings with 80% efficiency over elapsed time', () => {
      sim.addResource('gold', 100000);
      sim.buyFacility('fifi_broom', 10); // 10 Broom = 20 GPS (with 2x milestone)
      const baseGPS = sim.getTotalGPS();
      expect(baseGPS).toBeGreaterThanOrEqual(20);

      const now = Date.now();
      // Simulate save made 3,600 seconds (1 hour) ago
      (sim as any).state.lastTickTimestamp = now - 3600 * 1000;

      const offline = calculateOfflineProgress(sim.getState(), now, 0.80);
      expect(offline.elapsedSeconds).toBe(3600);

      // Expected gold = baseGPS * 3600 * 0.80
      const expected = Math.floor(baseGPS * 3600 * 0.80);
      expect(offline.earnedGold).toBeCloseTo(expected, -1);
    });

    it('caps offline progress time to 24 hours (86,400 seconds)', () => {
      const now = Date.now();
      // Simulate save made 3 days (259,200 seconds) ago
      (sim as any).state.lastTickTimestamp = now - 259200 * 1000;

      const offline = calculateOfflineProgress(sim.getState(), now, 0.80);
      expect(offline.elapsedSeconds).toBe(86400);
    });

    it('awards zero offline gains for negligible elapsed time (< 1s)', () => {
      const now = Date.now();
      (sim as any).state.lastTickTimestamp = now;

      const offline = calculateOfflineProgress(sim.getState(), now, 0.80);
      expect(offline.elapsedSeconds).toBe(0);
      expect(offline.earnedGold).toBe(0);
    });

    it('automatically credits offline earnings when loadSaveData is called', () => {
      sim.addResource('gold', 100000);
      sim.buyFacility('fifi_broom', 5);
      const saveJson = sim.getSaveData();

      // Modify timestamp in save JSON to be 1000 seconds in the past
      const parsed = JSON.parse(saveJson);
      parsed.timestamp = Date.now() - 1000 * 1000;
      const modifiedJson = JSON.stringify(parsed);

      const newSim = new GameSimulation({ seed: 'new-seed' });
      const initialGold = parsed.currencies.gold;

      const loadSuccess = newSim.loadSaveData(modifiedJson);
      expect(loadSuccess).toBe(true);

      // New sim gold should be initialGold + offline gold earned
      expect(newSim.getState().currencies.gold).toBeGreaterThan(initialGold);
    });
  });
});
