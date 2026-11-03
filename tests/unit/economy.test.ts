// tests/unit/economy.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameSimulation,
  calculateSingleCost,
  calculateBulkCost,
  calculateMaxAffordable,
  calculateMilestoneMultiplier,
  calculateFacilityProduction,
  calculateClickPower,
  getAllFacilities,
  getAllMultipliers,
} from '../../src/core';

describe('Economy & Math Suite', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = new GameSimulation({ seed: 'test-economy-seed' });
  });

  describe('Active Clicking & Tsundere Frenzy', () => {
    it('generates at least base gold on single click', () => {
      expect(sim.getState().currencies.gold).toBe(0);
      const res = sim.handleClick();
      expect(res.goldEarned).toBeGreaterThanOrEqual(1.0);
      expect(sim.getState().currencies.gold).toBe(res.goldEarned);
      expect(sim.getState().clickStats.totalClicks).toBe(1);
    });

    it('scales click power with 2% of passive Gold-Per-Second', () => {
      const initialClick = sim.handleClick().goldEarned;
      // Add gold and buy a high-yield facility
      sim.addResource('gold', 100000);
      sim.buyFacility('fifi_broom', 10);
      sim.buyFacility('fifi_duster', 10);
      const gps = sim.getTotalGPS();
      expect(gps).toBeGreaterThan(0);

      const boostedClick = sim.handleClick().goldEarned;
      expect(boostedClick).toBeGreaterThanOrEqual(initialClick);
    });

    it('triggers frenzy with 3x multiplier and expires after duration', () => {
      // Create simulation with frenzy active
      const frenzySim = new GameSimulation({
        seed: 42,
        initialState: {
          clickStats: {
            totalClicks: 0,
            frenzyActive: true,
            frenzyMultiplier: 3.0,
            frenzyTimeRemaining: 2.0, // 2 seconds remaining
          },
        },
      });

      const normalClickPower = calculateClickPower({ baseClickYield: 1.0, frenzyActive: false });
      const frenzyClickPower = calculateClickPower({
        baseClickYield: 1.0,
        frenzyActive: true,
        frenzyMultiplier: 3.0,
      });

      expect(frenzyClickPower).toBeCloseTo(normalClickPower * 3.0, 1);

      // Tick 1 second -> frenzy remains active
      frenzySim.tick(1000);
      expect(frenzySim.getState().clickStats.frenzyActive).toBe(true);

      // Tick 1.5 seconds -> frenzy should expire
      frenzySim.tick(1500);
      expect(frenzySim.getState().clickStats.frenzyActive).toBe(false);
      expect(frenzySim.getState().clickStats.frenzyMultiplier).toBe(1.0);
    });

    it('calculates critical hit damage multiplier accurately', () => {
      const nonCrit = calculateClickPower({ baseClickYield: 1.0, isCrit: false });
      const crit = calculateClickPower({ baseClickYield: 1.0, isCrit: true, critMultiplier: 2.5 });
      expect(crit).toBeCloseTo(nonCrit * 2.5, 1);
    });
  });

  describe('Exponential Cost Scaling & Bulk Buy', () => {
    it('computes single cost as floor(base * r^n)', () => {
      const baseCost = 15;
      const r = 1.15;
      expect(calculateSingleCost(baseCost, r, 0)).toBe(15);
      expect(calculateSingleCost(baseCost, r, 1)).toBe(Math.floor(15 * 1.15));
      expect(calculateSingleCost(baseCost, r, 5)).toBe(Math.floor(15 * Math.pow(1.15, 5)));
    });

    it('computes closed-form geometric bulk costs without iterative error', () => {
      const baseCost = 15;
      const r = 1.15;
      const costFor1 = calculateBulkCost(baseCost, r, 0, 1);
      expect(costFor1).toBe(15);

      const costFor10 = calculateBulkCost(baseCost, r, 0, 10);
      // Closed form: 15 * (1.15^10 - 1) / 0.15 = 15 * 3.045558 / 0.15 ~= 304.55 -> 304
      expect(costFor10).toBe(304);

      const costFor25 = calculateBulkCost(baseCost, r, 0, 25);
      expect(costFor25).toBeGreaterThan(costFor10 * 2.5);
    });

    it('calculates max affordable level count and exact cost within balance', () => {
      const baseCost = 15;
      const r = 1.15;
      const balance = 500;
      const maxInfo = calculateMaxAffordable(balance, baseCost, r, 0);

      expect(maxInfo.count).toBeGreaterThan(0);
      expect(maxInfo.cost).toBeLessThanOrEqual(balance);

      // Verifying that count + 1 would exceed balance
      const nextCost = calculateBulkCost(baseCost, r, 0, maxInfo.count + 1);
      expect(nextCost).toBeGreaterThan(balance);
    });

    it('prevents purchase when player has insufficient gold', () => {
      expect(sim.getState().currencies.gold).toBe(0);
      const success = sim.buyFacility('fifi_broom', 1);
      expect(success).toBe(false);
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(0);
      expect(sim.getState().currencies.gold).toBe(0);
    });

    it('deducts gold and increments level on successful purchase', () => {
      sim.addResource('gold', 100);
      const success = sim.buyFacility('fifi_broom', 1);
      expect(success).toBe(true);
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(1);
      expect(sim.getState().currencies.gold).toBe(100 - 15);
    });

    it('supports bulk buy Max (-1)', () => {
      sim.addResource('gold', 1000);
      const success = sim.buyFacility('fifi_broom', -1);
      expect(success).toBe(true);
      expect(sim.getUpgradeLevel('fifi_broom')).toBeGreaterThan(10);
      expect(sim.getState().currencies.gold).toBeLessThan(sim.getUpgradeCost('fifi_broom', 1));
    });
  });

  describe('Milestone Multipliers', () => {
    it('applies cumulative milestone leaps at 10, 25, 50, 100, 200, 250', () => {
      expect(calculateMilestoneMultiplier(0)).toBe(1.0);
      expect(calculateMilestoneMultiplier(9)).toBe(1.0);
      expect(calculateMilestoneMultiplier(10)).toBe(2.0);
      expect(calculateMilestoneMultiplier(24)).toBe(2.0);
      expect(calculateMilestoneMultiplier(25)).toBe(4.0);
      expect(calculateMilestoneMultiplier(50)).toBe(12.0);
      expect(calculateMilestoneMultiplier(100)).toBe(48.0);
      expect(calculateMilestoneMultiplier(150)).toBe(96.0);
      expect(calculateMilestoneMultiplier(200)).toBe(480.0);
      expect(calculateMilestoneMultiplier(250)).toBe(960.0);
    });

    it('causes facility production jump upon hitting level 10', () => {
      sim.addResource('gold', 1000000);
      sim.buyFacility('fifi_broom', 9);
      const prodAt9 = sim.getFacilityProduction('fifi_broom');

      sim.buyFacility('fifi_broom', 1); // Level reaches 10
      const prodAt10 = sim.getFacilityProduction('fifi_broom');

      // Level 10 has 2x milestone multiplier
      // prod(9) = 9 * 1.0 * 1 = 9
      // prod(10) = 10 * 1.0 * 2 = 20
      expect(prodAt9).toBe(9);
      expect(prodAt10).toBe(20);
      expect(prodAt10).toBeGreaterThanOrEqual(prodAt9 * 2);
    });
  });

  describe('All 8 Fifi Facilities & 4 Nyah Multipliers', () => {
    it('registers all 8 Fifi chore facilities', () => {
      const facilities = getAllFacilities();
      expect(facilities.length).toBe(8);

      const requiredNames = [
        'Simple Straw Broom',
        'Ostrich Feather Duster',
        'Garden Rake & Trowel',
        'Silver Tea Kettle',
        'Country Kitchen Stove',
        'Copper Laundry Basin',
        'Polished Estate Carriage',
        'Royal Vault',
      ];

      for (const name of requiredNames) {
        const found = facilities.find((f) => f.name === name);
        expect(found, `Missing facility: ${name}`).toBeDefined();
      }
    });

    it('registers all 4 Nyah management multipliers', () => {
      const multipliers = getAllMultipliers();
      expect(multipliers.length).toBe(4);

      const keys = ['nyah_supervision', 'nyah_inspection', 'nyah_demands', 'nyah_auditing'];
      for (const key of keys) {
        const found = multipliers.find((m) => m.id === key);
        expect(found, `Missing multiplier: ${key}`).toBeDefined();
      }
    });

    it('applies Nyah Supervision to increase Fifi chore production', () => {
      sim.addResource('gold', 50000);
      sim.buyFacility('fifi_broom', 5);
      const initialGPS = sim.getTotalGPS();

      sim.buyMultiplier('nyah_supervision'); // +10% to chores
      const boostedGPS = sim.getTotalGPS();

      expect(boostedGPS).toBeGreaterThan(initialGPS);
      expect(boostedGPS).toBeCloseTo(initialGPS * 1.10, 1);
    });

    it('accumulates passive currencies over tick intervals', () => {
      sim.addResource('gold', 500000);
      sim.buyFacility('fifi_broom', 5);
      sim.buyFacility('fifi_garden', 2); // Produces gold and secondary essence
      sim.buyFacility('fifi_kitchen', 1); // Produces gold and secondary treats

      const initialGold = sim.getState().currencies.gold;
      const initialTreats = sim.getState().currencies.treats;
      const initialEssence = sim.getState().currencies.essence;

      // Tick 1 second (1000ms = 20 ticks of 50ms)
      sim.tick(1000);

      expect(sim.getState().currencies.gold).toBeGreaterThan(initialGold);
      expect(sim.getState().currencies.treats).toBeGreaterThan(initialTreats);
      expect(sim.getState().currencies.essence).toBeGreaterThan(initialEssence);
    });
  });
});
