// tests/unit/territory.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation, getAllZones, findZone } from '../../src/core';

describe('Territory & Estate Progression Suite', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = new GameSimulation({ seed: 'test-territory-seed' });
  });

  describe('Zone Registry & Starter Tier', () => {
    it('defines exactly 5 progressive expansion tiers', () => {
      const zones = getAllZones();
      expect(zones.length).toBe(5);

      const tiers = zones.map((z) => z.tier);
      expect(tiers).toEqual([1, 2, 3, 4, 5]);
    });

    it('initializes game with Tier 1 (Dusty Parlor) unlocked', () => {
      const state = sim.getState();
      expect(state.territory.currentTier).toBe(1);
      expect(state.territory.unlockedZones).toContain('zone_01_parlor');
      expect(state.territory.unlockedZones.length).toBe(1);
    });

    it('supports alias lookups for zones', () => {
      expect(findZone('kitchen_garden')?.id).toBe('zone_02_kitchen_garden');
      expect(findZone('pond')?.id).toBe('zone_03_pond_courtyard');
      expect(findZone('sanctuary')?.id).toBe('zone_04_library_balcony');
      expect(findZone('observatory')?.id).toBe('zone_05_starlight_observatory');
    });
  });

  describe('Prerequisite Checks & Unlocking', () => {
    it('fails to unlock Zone 2 when player has insufficient gold', () => {
      sim.addResource('gold', 100); // Zone 2 requires 500 gold
      // Add 25 clicks to satisfy chore requirement
      for (let i = 0; i < 25; i++) sim.handleClick();

      const success = sim.unlockTerritory('zone_02_kitchen_garden');
      expect(success).toBe(false);
      expect(sim.getState().territory.unlockedZones).not.toContain('zone_02_kitchen_garden');
    });

    it('fails to unlock Zone 2 when chore count is below 25', () => {
      sim.addResource('gold', 1000);
      // Only 5 clicks
      for (let i = 0; i < 5; i++) sim.handleClick();

      const success = sim.unlockTerritory('zone_02_kitchen_garden');
      expect(success).toBe(false);
      expect(sim.getState().territory.unlockedZones).not.toContain('zone_02_kitchen_garden');
    });

    it('successfully unlocks Zone 2 when all prerequisites are met', () => {
      sim.addResource('gold', 1000);
      for (let i = 0; i < 25; i++) sim.handleClick();

      const initialGold = sim.getState().currencies.gold;
      const success = sim.unlockTerritory('zone_02_kitchen_garden');

      expect(success).toBe(true);
      expect(sim.getState().territory.unlockedZones).toContain('zone_02_kitchen_garden');
      expect(sim.getState().territory.currentTier).toBe(2);
      expect(sim.getState().currencies.gold).toBe(initialGold - 500);
    });

    it('strictly enforces sequential prerequisite chain (cannot skip to Zone 3)', () => {
      // Give abundant resources but Zone 2 is NOT unlocked
      sim.addResource('gold', 100000);
      sim.addResource('treats', 100);

      const successZone3 = sim.unlockTerritory('zone_03_pond_courtyard');
      expect(successZone3).toBe(false);
      expect(sim.getState().territory.unlockedZones).not.toContain('zone_03_pond_courtyard');

      // Now unlock Zone 2 first
      for (let i = 0; i < 25; i++) sim.handleClick();
      const successZone2 = sim.unlockTerritory('zone_02_kitchen_garden');
      expect(successZone2).toBe(true);

      // Now Zone 3 succeeds!
      const successZone3Now = sim.unlockTerritory('zone_03_pond_courtyard');
      expect(successZone3Now).toBe(true);
      expect(sim.getState().territory.unlockedZones).toContain('zone_03_pond_courtyard');
      expect(sim.getState().territory.currentTier).toBe(3);
    });

    it('progresses to Tier 5 (Starlight Observatory) with full resources', () => {
      sim.addResource('gold', 20000000);
      sim.addResource('treats', 1000);
      sim.addResource('essence', 10000);
      for (let i = 0; i < 25; i++) sim.handleClick();

      expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(true);
      expect(sim.unlockTerritory('zone_03_pond_courtyard')).toBe(true);
      expect(sim.unlockTerritory('zone_04_library_balcony')).toBe(true);
      expect(sim.unlockTerritory('zone_05_starlight_observatory')).toBe(true);

      expect(sim.getState().territory.currentTier).toBe(5);
      expect(sim.getState().territory.unlockedZones.length).toBe(5);
    });

    it('rejects unlocking an already unlocked zone', () => {
      const success = sim.unlockTerritory('zone_01_parlor');
      expect(success).toBe(false);
    });
  });

  describe('Territory Production Multipliers', () => {
    it('applies territory production bonuses to passive income', () => {
      sim.addResource('gold', 100000);
      sim.buyFacility('fifi_broom', 10);
      const initialGPS = sim.getTotalGPS();

      // Unlock Zone 2 (+15% gold bonus)
      for (let i = 0; i < 25; i++) sim.handleClick();
      sim.unlockTerritory('zone_02_kitchen_garden');

      const boostedGPS = sim.getTotalGPS();
      expect(boostedGPS).toBeGreaterThan(initialGPS);
      expect(boostedGPS).toBeCloseTo(initialGPS * 1.15, 1);
    });
  });
});
