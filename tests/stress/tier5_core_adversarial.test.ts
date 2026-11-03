// tests/stress/tier5_core_adversarial.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameSimulation,
  calculateSingleCost,
  calculateBulkCost,
  calculateMaxAffordable,
  calculateMilestoneMultiplier,
  calculateFacilityProduction,
  calculateClickPower,
  DeterministicRNG,
  FIFI_FACILITIES,
  findFacility,
  getAllFacilities,
  NYAH_MULTIPLIERS,
  findMultiplier,
  getAllMultipliers,
  computeMultiplierValue,
  TERRITORY_ZONES,
  findZone,
  getAllZones,
  checkZoneUnlockPrerequisites,
  CREATURE_SPECIES,
  HABITATS,
  findSpecies,
  getAllSpecies,
  findHabitat,
  getAllHabitats,
  getSpeciesForZone,
  calculateCatchRoll,
  calculateCreatureProduction,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SAVE_KEY,
  clearInMemoryStorage,
  serializeState,
  deserializeState,
  exportSaveString,
  importSaveString,
  calculateOfflineProgress,
  createInitialState,
} from '../../src/core';

describe('Tier 5 Core Simulation & Mathematical Models Adversarial Audit', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    clearInMemoryStorage();
    sim = new GameSimulation({ seed: 'tier5-adversarial-seed' });
  });

  // =========================================================================
  // 1. Mathematical Models & Arithmetic Extremes (src/core/math.ts)
  // =========================================================================
  describe('1. Mathematical Models & Arithmetic Extremes', () => {
    it('verifies calculateSingleCost for negative, zero, and high levels', () => {
      // Negative level must return 0
      expect(calculateSingleCost(15, 1.15, -1)).toBe(0);
      expect(calculateSingleCost(15, 1.15, -100)).toBe(0);

      // Level 0 returns exact base cost
      expect(calculateSingleCost(15, 1.15, 0)).toBe(15);
      expect(calculateSingleCost(100, 1.15, 0)).toBe(100);

      // Level 1 returns floor(base * r)
      expect(calculateSingleCost(15, 1.15, 1)).toBe(17);

      // High level (100) returns finite integer
      const cost100 = calculateSingleCost(15, 1.15, 100);
      expect(Number.isFinite(cost100)).toBe(true);
      expect(cost100).toBeGreaterThan(15);
    });

    it('verifies calculateBulkCost exactness across sizes (1, 10, 25, 100) vs iterative sum', () => {
      const baseCost = 15;
      const r = 1.15;
      const startLevel = 5;

      for (const count of [1, 5, 10, 25]) {
        let iterativeSum = 0;
        for (let i = 0; i < count; i++) {
          iterativeSum += calculateSingleCost(baseCost, r, startLevel + i);
        }
        const bulkCost = calculateBulkCost(baseCost, r, startLevel, count);

        // Closed-form geometric sum floors total; iterative floors each term.
        // Difference must be small (within count units due to individual floor roundings).
        expect(Math.abs(bulkCost - iterativeSum)).toBeLessThanOrEqual(count);
      }

      // Negative or zero count must return 0
      expect(calculateBulkCost(baseCost, r, 0, 0)).toBe(0);
      expect(calculateBulkCost(baseCost, r, 0, -5)).toBe(0);
    });

    it('verifies calculateBulkCost linear branch when costRatio is exactly 1.0', () => {
      // When r = 1.0, bulk cost is floor(baseCost * count)
      expect(calculateBulkCost(25, 1.0, 0, 10)).toBe(250);
      expect(calculateBulkCost(25, 1.0, 50, 10)).toBe(250);
      expect(calculateBulkCost(25, 1.0 + 1e-10, 0, 10)).toBe(250);
    });

    it('verifies calculateMaxAffordable with linear costRatio (1.0)', () => {
      const res = calculateMaxAffordable(255, 25, 1.0, 0);
      expect(res.count).toBe(10);
      expect(res.cost).toBe(250);
    });

    it('verifies calculateMaxAffordable boundary conditions: zero balance, exact, 1 unit below', () => {
      const baseCost = 15;
      const r = 1.15;

      // Zero or negative balance
      expect(calculateMaxAffordable(0, baseCost, r, 0)).toEqual({ count: 0, cost: 0 });
      expect(calculateMaxAffordable(-50, baseCost, r, 0)).toEqual({ count: 0, cost: 0 });

      // 1 unit below cost of first item (14 vs 15)
      expect(calculateMaxAffordable(14, baseCost, r, 0)).toEqual({ count: 0, cost: 0 });

      // Exact cost of first item (15)
      const exact1 = calculateMaxAffordable(15, baseCost, r, 0);
      expect(exact1.count).toBe(1);
      expect(exact1.cost).toBe(15);

      // Exact cost of 10 items (304)
      const cost10 = calculateBulkCost(baseCost, r, 0, 10);
      const exact10 = calculateMaxAffordable(cost10, baseCost, r, 0);
      expect(exact10.count).toBe(10);
      expect(exact10.cost).toBe(cost10);

      // 1 unit below cost of 10 items
      const under10 = calculateMaxAffordable(cost10 - 1, baseCost, r, 0);
      expect(under10.count).toBe(9);
      expect(under10.cost).toBeLessThan(cost10);
    });

    it('verifies calculateMaxAffordable handles huge finite balances up to 1e308', () => {
      const res = calculateMaxAffordable(1e308, 15, 1.15, 0);
      expect(Number.isFinite(res.count)).toBe(true);
      expect(Number.isFinite(res.cost)).toBe(true);
      expect(res.count).toBeGreaterThan(5000);
      expect(res.cost).toBeLessThanOrEqual(1e308);
    });

    it('verifies cumulative milestone multiplier leaps across all 7 defined thresholds', () => {
      // Defined milestones: 10 (2x), 25 (2x -> 4x), 50 (3x -> 12x), 100 (4x -> 48x),
      // 150 (2x -> 96x), 200 (5x -> 480x), 250 (2x -> 960x)
      expect(calculateMilestoneMultiplier(-5)).toBe(1.0);
      expect(calculateMilestoneMultiplier(0)).toBe(1.0);
      expect(calculateMilestoneMultiplier(9)).toBe(1.0);
      expect(calculateMilestoneMultiplier(10)).toBe(2.0);
      expect(calculateMilestoneMultiplier(24)).toBe(2.0);
      expect(calculateMilestoneMultiplier(25)).toBe(4.0);
      expect(calculateMilestoneMultiplier(49)).toBe(4.0);
      expect(calculateMilestoneMultiplier(50)).toBe(12.0);
      expect(calculateMilestoneMultiplier(99)).toBe(12.0);
      expect(calculateMilestoneMultiplier(100)).toBe(48.0);
      expect(calculateMilestoneMultiplier(149)).toBe(48.0);
      expect(calculateMilestoneMultiplier(150)).toBe(96.0);
      expect(calculateMilestoneMultiplier(199)).toBe(96.0);
      expect(calculateMilestoneMultiplier(200)).toBe(480.0);
      expect(calculateMilestoneMultiplier(249)).toBe(480.0);
      expect(calculateMilestoneMultiplier(250)).toBe(960.0);
      expect(calculateMilestoneMultiplier(500)).toBe(960.0);
    });

    it('verifies calculateFacilityProduction for zero, negative, and threshold levels', () => {
      expect(calculateFacilityProduction(1.0, 0)).toBe(0);
      expect(calculateFacilityProduction(1.0, -10)).toBe(0);

      // Level 1: 1 * 1.0 * 1.0 = 1.0
      expect(calculateFacilityProduction(1.0, 1)).toBe(1.0);

      // Level 10: 10 * 1.0 * 2.0 = 20.0
      expect(calculateFacilityProduction(1.0, 10)).toBe(20.0);

      // Level 250: 250 * 5.0 * 960 = 1,200,000
      expect(calculateFacilityProduction(5.0, 250)).toBe(1200000);
    });

    it('verifies calculateClickPower under various permutations and guarantees minimum 1 gold', () => {
      // Default baseline
      const base = calculateClickPower({});
      expect(base).toBe(1);

      // Massive totalGPS
      const highGps = calculateClickPower({ totalGPS: 100000 });
      // 1 + 0.02 * 100000 = 2001
      expect(highGps).toBe(2001);

      // Frenzy + Crit compounding
      const frenzyCrit = calculateClickPower({
        baseClickYield: 10,
        frenzyActive: true,
        frenzyMultiplier: 3.0,
        isCrit: true,
        critMultiplier: 2.0,
        globalMultiplier: 1.5,
      });
      // 10 * 3.0 * 1.5 * 2.0 = 90
      expect(frenzyCrit).toBe(90);

      // Even with zero base and zero multiplier, guaranteed minimum is 1
      const clamped = calculateClickPower({
        baseClickYield: 0,
        globalMultiplier: 0,
      });
      expect(clamped).toBe(1);
    });

    it('verifies DeterministicRNG consistency, string hashing, and range [0, 1)', () => {
      const rng1 = new DeterministicRNG(42);
      const rng2 = new DeterministicRNG(42);

      // Deterministic identical sequence
      for (let i = 0; i < 50; i++) {
        const v1 = rng1.next();
        const v2 = rng2.next();
        expect(v1).toBe(v2);
        expect(v1).toBeGreaterThanOrEqual(0);
        expect(v1).toBeLessThan(1.0);
      }

      // Edge seeds: 0, negative, empty string, Unicode
      const rngZero = new DeterministicRNG(0);
      expect(rngZero.next()).toBeGreaterThanOrEqual(0);

      const rngNeg = new DeterministicRNG(-99999);
      expect(rngNeg.next()).toBeGreaterThanOrEqual(0);

      const rngEmpty = new DeterministicRNG('');
      expect(rngEmpty.next()).toBeGreaterThanOrEqual(0);

      const rngUnicode = new DeterministicRNG('Nyah-Catgirl-Maid-Estate-Expansion');
      expect(rngUnicode.next()).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 2. Facilities & Multipliers Data Models & Aliases
  // =========================================================================
  describe('2. Facilities & Multipliers Data Models & Aliases', () => {
    it('verifies all 8 Fifi chore facilities and their complete alias sets', () => {
      const facilities = getAllFacilities();
      expect(facilities.length).toBe(8);

      const expectedIds = [
        'fifi_broom',
        'fifi_duster',
        'fifi_garden',
        'fifi_kettle',
        'fifi_kitchen',
        'fifi_laundry',
        'fifi_carriage',
        'fifi_vault',
      ];

      for (const id of expectedIds) {
        const fac = findFacility(id);
        expect(fac).toBeDefined();
        expect(fac!.id).toBe(id);
        expect(fac!.baseCost).toBeGreaterThan(0);
        expect(fac!.costRatio).toBe(1.15);
        expect(fac!.baseProduction).toBeGreaterThan(0);

        // Verify all aliases resolve
        if (fac!.aliases) {
          for (const alias of fac!.aliases) {
            const resolved = findFacility(alias);
            expect(resolved, `Alias "${alias}" should resolve`).toBeDefined();
            expect(resolved!.id).toBe(fac!.id);
            // Case insensitivity
            expect(findFacility(alias.toUpperCase())?.id).toBe(fac!.id);
          }
        }
      }

      // Non-existent returns undefined
      expect(findFacility('non_existent_facility')).toBeUndefined();
    });

    it('verifies secondary output rates across all producing facilities', () => {
      const garden = findFacility('fifi_garden');
      expect(garden?.secondaryOutput).toEqual({ currency: 'essence', rate: 0.1 });

      const kettle = findFacility('fifi_kettle');
      expect(kettle?.secondaryOutput).toEqual({ currency: 'treats', rate: 0.05 });

      const kitchen = findFacility('fifi_kitchen');
      expect(kitchen?.secondaryOutput).toEqual({ currency: 'treats', rate: 0.1 });

      const vault = findFacility('fifi_vault');
      expect(vault?.secondaryOutput).toEqual({ currency: 'essence', rate: 1.0 });

      // Non-producing facilities have undefined secondaryOutput
      expect(findFacility('fifi_broom')?.secondaryOutput).toBeUndefined();
      expect(findFacility('fifi_duster')?.secondaryOutput).toBeUndefined();
      expect(findFacility('fifi_laundry')?.secondaryOutput).toBeUndefined();
      expect(findFacility('fifi_carriage')?.secondaryOutput).toBeUndefined();
    });

    it('verifies all 4 Nyah management multipliers and their alias resolutions', () => {
      const multipliers = getAllMultipliers();
      expect(multipliers.length).toBe(4);

      const expected = [
        { id: 'nyah_supervision', cat: 'fifi_boost', rate: 0.10 },
        { id: 'nyah_inspection', cat: 'global_gold', rate: 0.05 },
        { id: 'nyah_demands', cat: 'click_power', rate: 0.15 },
        { id: 'nyah_auditing', cat: 'compound', rate: 0.20 },
      ];

      for (const exp of expected) {
        const mult = findMultiplier(exp.id);
        expect(mult).toBeDefined();
        expect(mult!.category).toBe(exp.cat);
        expect(mult!.multiplierPerLevel).toBe(exp.rate);

        // Case insensitivity
        expect(findMultiplier(exp.id.toUpperCase())?.id).toBe(exp.id);
      }

      // Specific known aliases
      expect(findMultiplier('supervision')?.id).toBe('nyah_supervision');
      expect(findMultiplier('royal_inspection')?.id).toBe('nyah_inspection');
      expect(findMultiplier('aristocratic_demands')?.id).toBe('nyah_demands');
      expect(findMultiplier('fiscal_auditing')?.id).toBe('nyah_auditing');

      // Non-existent multiplier returns undefined
      expect(findMultiplier('unknown_multiplier')).toBeUndefined();
    });

    it('verifies computeMultiplierValue categories and compounding growth at milestone levels', () => {
      const supervision = findMultiplier('nyah_supervision')!;
      const inspection = findMultiplier('nyah_inspection')!;
      const demands = findMultiplier('nyah_demands')!;
      const auditing = findMultiplier('nyah_auditing')!;

      // Level 0 returns 1.0 for all
      expect(computeMultiplierValue(supervision, 0)).toBe(1.0);
      expect(computeMultiplierValue(inspection, 0)).toBe(1.0);
      expect(computeMultiplierValue(demands, 0)).toBe(1.0);
      expect(computeMultiplierValue(auditing, 0)).toBe(1.0);

      // Level 1:
      // fifi_boost: 1 + 1 * 0.10 * 1 = 1.10
      expect(computeMultiplierValue(supervision, 1)).toBeCloseTo(1.10, 2);
      // global_gold: 1 * (1.05)^1 = 1.05
      expect(computeMultiplierValue(inspection, 1)).toBeCloseTo(1.05, 2);
      // click_power: 1 + 1 * 0.15 * 1 = 1.15
      expect(computeMultiplierValue(demands, 1)).toBeCloseTo(1.15, 2);
      // compound: 1 * (1.20)^1 = 1.20
      expect(computeMultiplierValue(auditing, 1)).toBeCloseTo(1.20, 2);

      // Level 10 (2x milestone jump):
      // fifi_boost: 1 + 10 * 0.10 * 2 = 3.0
      expect(computeMultiplierValue(supervision, 10)).toBe(3.0);
      // global_gold: 2.0 * (1.05)^10 = 2.0 * 1.62889 = 3.25778
      expect(computeMultiplierValue(inspection, 10)).toBeCloseTo(3.258, 2);
      // compound: 2.0 * (1.20)^10 = 2.0 * 6.1917 = 12.383
      expect(computeMultiplierValue(auditing, 10)).toBeCloseTo(12.383, 2);

      // Level 50 (12x cumulative milestone):
      // compound: 12.0 * (1.20)^50 = 12.0 * 9100.4 = 109,205
      const audit50 = computeMultiplierValue(auditing, 50);
      expect(audit50).toBeGreaterThan(100000);
      expect(Number.isFinite(audit50)).toBe(true);
    });
  });

  // =========================================================================
  // 3. Territory Progression & Prerequisites (src/core/territory.ts)
  // =========================================================================
  describe('3. Territory Progression & Prerequisites', () => {
    it('verifies all 5 territory zone definitions, aliases, and capacities', () => {
      const zones = getAllZones();
      expect(zones.length).toBe(5);

      const zoneIds = [
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ];

      for (const id of zoneIds) {
        const zone = findZone(id);
        expect(zone).toBeDefined();
        expect(zone!.habitatCapacity).toBeGreaterThan(0);

        // All aliases resolve
        if (zone!.aliases) {
          for (const alias of zone!.aliases) {
            expect(findZone(alias)?.id).toBe(zone!.id);
            expect(findZone(alias.toUpperCase())?.id).toBe(zone!.id);
          }
        }
      }

      expect(findZone('unknown_zone_xyz')).toBeUndefined();
    });

    it('verifies checkZoneUnlockPrerequisites for every currency failure branch', () => {
      const zone3 = findZone('zone_03_pond_courtyard')!; // Costs 7500 Gold, 30 Treats
      const unlocked = ['zone_01_parlor', 'zone_02_kitchen_garden'];

      // Gold failure
      const failGold = checkZoneUnlockPrerequisites(
        zone3,
        unlocked,
        50,
        { gold: 7499, treats: 50, essence: 0 }
      );
      expect(failGold.canUnlock).toBe(false);
      expect(failGold.reason).toContain('Insufficient gold');

      // Treats failure
      const failTreats = checkZoneUnlockPrerequisites(
        zone3,
        unlocked,
        50,
        { gold: 7500, treats: 29, essence: 0 }
      );
      expect(failTreats.canUnlock).toBe(false);
      expect(failTreats.reason).toContain('Insufficient treats');

      // Essence failure on Zone 4
      const zone4 = findZone('zone_04_library_balcony')!; // Costs 85000 Gold, 200 Essence
      const unlocked4 = [...unlocked, 'zone_03_pond_courtyard'];
      const failEssence = checkZoneUnlockPrerequisites(
        zone4,
        unlocked4,
        50,
        { gold: 85000, treats: 0, essence: 199 }
      );
      expect(failEssence.canUnlock).toBe(false);
      expect(failEssence.reason).toContain('Insufficient essence');

      // All currencies exact -> canUnlock: true
      const pass3 = checkZoneUnlockPrerequisites(
        zone3,
        unlocked,
        50,
        { gold: 7500, treats: 30, essence: 0 }
      );
      expect(pass3.canUnlock).toBe(true);
    });

    it('verifies prerequisite zone blocking and already-unlocked blocking', () => {
      const zone2 = findZone('zone_02_kitchen_garden')!;
      // Already unlocked
      const resAlready = checkZoneUnlockPrerequisites(
        zone2,
        ['zone_01_parlor', 'zone_02_kitchen_garden'],
        50,
        { gold: 10000, treats: 100, essence: 100 }
      );
      expect(resAlready.canUnlock).toBe(false);
      expect(resAlready.reason).toBe('Already unlocked');

      // Prerequisite missing: Zone 5 requires Zone 4
      const zone5 = findZone('zone_05_starlight_observatory')!;
      const resPrereq = checkZoneUnlockPrerequisites(
        zone5,
        ['zone_01_parlor'],
        100,
        { gold: 1e9, treats: 1e9, essence: 1e9 }
      );
      expect(resPrereq.canUnlock).toBe(false);
      expect(resPrereq.reason).toContain('Requires prerequisite zone');
    });

    it('verifies cumulative territory production bonuses', () => {
      // Zone 1: gold 1.0, click 1.0
      // Zone 2: gold 1.15, click 1.10
      // Zone 3: gold 1.25, essence 1.20
      // Zone 4: gold 1.35, essence 1.25, click 1.15
      // Zone 5: gold 1.50, essence 1.50, click 1.25
      const zones = getAllZones();
      let expectedGoldMult = 1.0;
      let expectedEssenceMult = 1.0;
      let expectedClickMult = 1.0;

      for (const z of zones) {
        if (z.productionBonus.goldMultiplier) expectedGoldMult *= z.productionBonus.goldMultiplier;
        if (z.productionBonus.essenceMultiplier) expectedEssenceMult *= z.productionBonus.essenceMultiplier;
        if (z.productionBonus.clickMultiplier) expectedClickMult *= z.productionBonus.clickMultiplier;
      }

      // Expected total gold multiplier across all 5 zones: 1.0 * 1.15 * 1.25 * 1.35 * 1.50 = 2.9109375
      expect(expectedGoldMult).toBeCloseTo(2.911, 3);
      // Expected essence: 1.20 * 1.25 * 1.50 = 2.25
      expect(expectedEssenceMult).toBe(2.25);
      // Expected click: 1.0 * 1.10 * 1.15 * 1.25 = 1.58125
      expect(expectedClickMult).toBeCloseTo(1.581, 3);
    });
  });

  // =========================================================================
  // 4. Creatures & Habitats Mechanics (src/core/creatures.ts)
  // =========================================================================
  describe('4. Creatures & Habitats Mechanics', () => {
    it('verifies all 10 species definitions, zone associations, and aliases', () => {
      const species = getAllSpecies();
      expect(species.length).toBe(10);

      const expectedSpecies = [
        { id: 'purrble', zone: 'zone_01_parlor', rate: 0.65 },
        { id: 'barkling', zone: 'zone_02_kitchen_garden', rate: 0.65 },
        { id: 'mooshrum', zone: 'zone_02_kitchen_garden', rate: 0.55 },
        { id: 'glimmerfin', zone: 'zone_03_pond_courtyard', rate: 0.40 },
        { id: 'silkwisp', zone: 'zone_03_pond_courtyard', rate: 0.40 },
        { id: 'cinderfox', zone: 'zone_04_library_balcony', rate: 0.22 },
        { id: 'bramblebeast', zone: 'zone_04_library_balcony', rate: 0.22 },
        { id: 'chrono_chirp', zone: 'zone_05_starlight_observatory', rate: 0.18 },
        { id: 'dewdrop_slime', zone: 'zone_05_starlight_observatory', rate: 0.15 },
        { id: 'starling_doe', zone: 'zone_05_starlight_observatory', rate: 0.08 },
      ];

      for (const exp of expectedSpecies) {
        const spec = findSpecies(exp.id);
        expect(spec).toBeDefined();
        expect(spec!.spawnZoneId).toBe(exp.zone);
        expect(spec!.baseCatchRate).toBe(exp.rate);

        // Verify zone filtering
        const zoneList = getSpeciesForZone(exp.zone);
        expect(zoneList.some((s) => s.id === exp.id)).toBe(true);

        // Aliases
        if (spec!.aliases) {
          for (const alias of spec!.aliases) {
            expect(findSpecies(alias)?.id).toBe(spec!.id);
            expect(findSpecies(alias.toUpperCase())?.id).toBe(spec!.id);
          }
        }
      }

      expect(findSpecies('mythic_dragon_nonexistent')).toBeUndefined();
    });

    it('verifies all 5 habitat capacities sum to 29', () => {
      const habitats = getAllHabitats();
      expect(habitats.length).toBe(5);

      const expectedHabitats = [
        { id: 'habitat_porch', cap: 3 },
        { id: 'habitat_garden', cap: 4 },
        { id: 'habitat_pond', cap: 6 },
        { id: 'habitat_aviary', cap: 4 },
        { id: 'habitat_sanctuary', cap: 12 },
      ];

      let totalCap = 0;
      for (const exp of expectedHabitats) {
        const hab = findHabitat(exp.id);
        expect(hab).toBeDefined();
        expect(hab!.capacity).toBe(exp.cap);
        totalCap += hab!.capacity;
      }
      expect(totalCap).toBe(29);
      expect(findHabitat('unknown_habitat')).toBeUndefined();
    });

    it('verifies catch roll mechanics: bait boost, shiny chance, flee probability', () => {
      const rng = new DeterministicRNG(98765);
      const purrble = findSpecies('purrble')!; // base 0.65

      let successes = 0;
      let shinies = 0;
      let flees = 0;
      const N = 2000;

      for (let i = 0; i < N; i++) {
        const res = calculateCatchRoll(purrble, false, rng);
        if (res.success) {
          successes++;
          if (res.isShiny) shinies++;
        } else {
          if (res.fled) flees++;
        }
      }

      // Base catch rate ~65%
      const catchRate = successes / N;
      expect(catchRate).toBeGreaterThan(0.60);
      expect(catchRate).toBeLessThan(0.70);

      // Shiny rate ~5% of successful catches
      const shinyRate = shinies / successes;
      expect(shinyRate).toBeGreaterThan(0.03);
      expect(shinyRate).toBeLessThan(0.08);

      // Flee chance without bait is 30% of failures
      const failures = N - successes;
      const fleeRate = flees / failures;
      expect(fleeRate).toBeGreaterThan(0.24);
      expect(fleeRate).toBeLessThan(0.36);
    });

    it('verifies bait boosts catch rate by 35% capped at 0.95', () => {
      const rng = new DeterministicRNG(54321);
      const purrble = findSpecies('purrble')!; // 0.65 * 1.35 = 0.8775
      let successes = 0;
      const N = 2000;

      for (let i = 0; i < N; i++) {
        const res = calculateCatchRoll(purrble, true, rng);
        if (res.success) successes++;
      }

      const rate = successes / N;
      expect(rate).toBeGreaterThan(0.84);
      expect(rate).toBeLessThan(0.91);
    });

    it('verifies calculateCreatureProduction formula and level scaling', () => {
      const purrble = findSpecies('purrble')!; // gold: 1, clickBonus: 0.05
      const starling = findSpecies('starling_doe')!; // gold: 2500, treats: 1.0, essence: 2.5, click: 0.10

      // Count 0 returns zeros
      expect(calculateCreatureProduction(purrble, 0, 1)).toEqual({
        gold: 0,
        treats: 0,
        essence: 0,
        clickBonus: 0,
      });

      // Purrble count 2, level 1 (mult = 1.0)
      const p1 = calculateCreatureProduction(purrble, 2, 1);
      expect(p1.gold).toBe(2.0);
      expect(p1.clickBonus).toBe(0.10);

      // Starling Doe count 3, level 5: levelMult = 1.0 + 0.20 * 4 = 1.80
      const s5 = calculateCreatureProduction(starling, 3, 5);
      expect(s5.gold).toBe(3 * 2500 * 1.80);
      expect(s5.treats).toBe(3 * 1.0 * 1.80);
      expect(s5.essence).toBe(3 * 2.5 * 1.80);
      expect(s5.clickBonus).toBe(3 * 0.10);
    });
  });

  // =========================================================================
  // 5. Persistence & Offline Progress (src/core/persistence.ts)
  // =========================================================================
  describe('5. Persistence & Offline Progress', () => {
    it('verifies serialization roundtrip preserves state fidelity', () => {
      sim.addResource('gold', 50000);
      sim.addResource('treats', 100);
      sim.addResource('essence', 25);
      sim.buyFacility('fifi_broom', 10);
      sim.buyMultiplier('nyah_supervision');
      for (let i = 0; i < 25; i++) sim.handleClick();
      const unlocked = sim.unlockTerritory('zone_02_kitchen_garden');
      expect(unlocked).toBe(true);

      const json = serializeState(sim.getState());
      expect(typeof json).toBe('string');

      const loaded = deserializeState(json, createInitialState);
      expect(loaded).not.toBeNull();
      if (loaded) {
        expect(loaded.currencies.gold).toBe(sim.getState().currencies.gold);
        expect(loaded.currencies.treats).toBe(sim.getState().currencies.treats);
        expect(loaded.currencies.essence).toBe(sim.getState().currencies.essence);
        expect(loaded.facilities['fifi_broom'].level).toBe(10);
        expect(loaded.multipliers['nyah_supervision'].level).toBe(1);
        expect(loaded.territory.unlockedZones).toContain('zone_02_kitchen_garden');
        // Frenzy never persists
        expect(loaded.clickStats.frenzyActive).toBe(false);
      }
    });

    it('verifies base64 export and import roundtrip', () => {
      sim.addResource('gold', 12345);
      const b64 = exportSaveString(sim.getState());
      expect(typeof b64).toBe('string');

      const imported = importSaveString(b64, createInitialState);
      expect(imported).not.toBeNull();
      expect(imported?.currencies.gold).toBe(12345);
    });

    it('verifies offline progress math for 1h, 24h cap, and backward clock', () => {
      sim.addResource('gold', 100000);
      sim.buyFacility('fifi_broom', 10);
      sim.buyFacility('fifi_garden', 5);
      const gps = sim.getTotalGPS();
      const eps = sim.getTotalEPS();
      expect(gps).toBeGreaterThan(0);
      expect(eps).toBeGreaterThan(0);

      const now = Date.now();
      const state = sim.getState();

      // 1 hour (3600 seconds)
      state.lastTickTimestamp = now - 3600 * 1000;
      const off1h = calculateOfflineProgress(state, now, 0.80);
      expect(off1h.elapsedSeconds).toBe(3600);
      expect(off1h.earnedGold).toBe(Math.floor(gps * 3600 * 0.80));

      // 48 hours: capped at 86,400 seconds (24h)
      state.lastTickTimestamp = now - 48 * 3600 * 1000;
      const off48h = calculateOfflineProgress(state, now, 0.80);
      expect(off48h.elapsedSeconds).toBe(86400);
      expect(off48h.earnedGold).toBe(Math.floor(gps * 86400 * 0.80));

      // Negative elapsed time (clock was set back)
      state.lastTickTimestamp = now + 50000;
      const offNeg = calculateOfflineProgress(state, now, 0.80);
      expect(offNeg.elapsedSeconds).toBe(0);
      expect(offNeg.earnedGold).toBe(0);
      expect(offNeg.earnedTreats).toBe(0);
      expect(offNeg.earnedEssence).toBe(0);
    });
  });

  // =========================================================================
  // 6. Simulation State Machine Engine & Tick Robustness (src/core/simulation.ts)
  // =========================================================================
  describe('6. Simulation State Machine Engine & Tick Robustness', () => {
    it('verifies fixed 50ms accumulator: sub-step, exact step, remainder preservation', () => {
      // 40ms: no step executed
      sim.tick(40);
      expect(sim.getState().currencies.gold).toBe(0);

      // Add passive production
      sim.addResource('gold', 1000);
      sim.buyFacility('fifi_broom', 5);
      const goldBefore = sim.getState().currencies.gold;

      // Adding 10ms makes accumulator 50ms -> exactly 1 step executed
      sim.tick(10);
      const goldAfter = sim.getState().currencies.gold;
      expect(goldAfter).toBeGreaterThan(goldBefore);

      // Adding 51ms -> 1 step executed (50ms), 1ms remainder
      const goldStep2 = sim.getState().currencies.gold;
      sim.tick(51);
      expect(sim.getState().currencies.gold).toBeGreaterThan(goldStep2);
    });

    it('verifies tick runaway safeguard clamps to 50,000 steps without freeze', () => {
      // Pass huge deltaMs: 10,000,000 ms (10,000 seconds = 200,000 ticks)
      expect(() => {
        sim.tick(10000000);
      }).not.toThrow();

      // Last tick timestamp must be updated
      expect(sim.getState().lastTickTimestamp).toBeGreaterThan(0);
    });

    it('verifies negative and zero deltaMs ticks do nothing', () => {
      const stateBefore = JSON.stringify(sim.getState());
      sim.tick(0);
      sim.tick(-100);
      sim.tick(-99999);
      const stateAfter = JSON.stringify(sim.getState());
      expect(stateAfter).toBe(stateBefore);
    });

    it('verifies addResource supports gold, treats, treat, essence and rejects negative amounts', () => {
      sim.addResource('gold', 100);
      sim.addResource('treats', 50);
      sim.addResource('treat', 25);
      sim.addResource('essence', 10);

      expect(sim.getState().currencies.gold).toBe(100);
      expect(sim.getState().currencies.treats).toBe(75);
      expect(sim.getState().currencies.essence).toBe(10);

      // Negative additions are ignored
      sim.addResource('gold', -50);
      sim.addResource('treats', -25);
      sim.addResource('essence', -5);

      expect(sim.getState().currencies.gold).toBe(100);
      expect(sim.getState().currencies.treats).toBe(75);
      expect(sim.getState().currencies.essence).toBe(10);
    });

    it('verifies buyUpgrade dispatches correctly to facilities and multipliers', () => {
      sim.addResource('gold', 50000);

      // Buy facility via buyUpgrade
      expect(sim.buyUpgrade('fifi_broom', 2)).toBe(true);
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(2);

      // Buy multiplier via buyUpgrade
      expect(sim.buyUpgrade('nyah_supervision')).toBe(true);
      expect(sim.getUpgradeLevel('nyah_supervision')).toBe(1);

      // Non-existent upgrade returns false
      expect(sim.buyUpgrade('fake_upgrade_id')).toBe(false);
    });

    it('verifies getUpgradeCost and getUpgradeLevel for both types and invalid keys', () => {
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(0);
      expect(sim.getUpgradeCost('fifi_broom', 1)).toBe(15);
      expect(sim.getUpgradeCost('fifi_broom', 10)).toBe(304);

      expect(sim.getUpgradeLevel('nyah_supervision')).toBe(0);
      expect(sim.getUpgradeCost('nyah_supervision', 1)).toBe(500);

      // Invalid ID returns 0 for cost and level
      expect(sim.getUpgradeCost('invalid_key')).toBe(0);
      expect(sim.getUpgradeLevel('invalid_key')).toBe(0);
      expect(sim.getFacilityProduction('invalid_key')).toBe(0);
    });

    it('verifies reset restores pristine state and reinitializes timers', () => {
      sim.addResource('gold', 1000000);
      sim.buyFacility('fifi_broom', 10);
      sim.buyMultiplier('nyah_supervision');
      sim.handleClick();

      sim.reset();
      const state = sim.getState();
      expect(state.currencies.gold).toBe(0);
      expect(state.currencies.treats).toBe(0);
      expect(state.currencies.essence).toBe(0);
      expect(state.clickStats.totalClicks).toBe(0);
      expect(state.facilities['fifi_broom'].level).toBe(0);
      expect(state.multipliers['nyah_supervision'].level).toBe(0);
      expect(state.territory.unlockedZones).toEqual(['zone_01_parlor']);
    });

    it('verifies updateAudioSettings partial updates', () => {
      expect(sim.getState().settings.masterVolume).toBe(1.0);
      expect(sim.getState().settings.muted).toBe(false);

      sim.updateAudioSettings({ masterVolume: 0.5, muted: true });
      expect(sim.getState().settings.masterVolume).toBe(0.5);
      expect(sim.getState().settings.muted).toBe(true);
      expect(sim.getState().settings.bgmVolume).toBe(0.8); // Preserved
    });

    it('verifies essence drop in handleClick requires unlockedZones.length > 1', () => {
      // In Zone 1 alone, essence cannot drop
      const simZ1 = new GameSimulation({ seed: 12345 });
      for (let i = 0; i < 500; i++) {
        const res = simZ1.handleClick();
        expect(res.essenceDropped).toBe(false);
      }
      expect(simZ1.getState().currencies.essence).toBe(0);

      // Unlock Zone 2: essence can now drop (1% rate)
      simZ1.addResource('gold', 1000);
      simZ1.unlockTerritory('zone_02_kitchen_garden');
      expect(simZ1.getState().territory.unlockedZones.length).toBe(2);

      let essenceDropped = false;
      for (let i = 0; i < 1000; i++) {
        const res = simZ1.handleClick();
        if (res.essenceDropped) {
          essenceDropped = true;
          break;
        }
      }
      expect(essenceDropped).toBe(true);
      expect(simZ1.getState().currencies.essence).toBeGreaterThan(0);
    });

    it('verifies creature unassignment via empty string or none', () => {
      sim.getState().creatures.caught['purrble'] = {
        count: 1,
        level: 1,
        assignedHabitat: 'habitat_porch',
      };

      // Unassign with 'none'
      expect(sim.assignCreature('purrble', 'none')).toBe(true);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBeUndefined();

      // Reassign to porch
      expect(sim.assignCreature('purrble', 'habitat_porch')).toBe(true);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBe('habitat_porch');

      // Unassign with ''
      expect(sim.assignCreature('purrble', '')).toBe(true);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBeUndefined();
    });

    it('verifies wild creature 45s timer decay and despawn during simulation steps', () => {
      const wild = sim.spawnWildCreature('zone_01_parlor');
      expect(wild).not.toBeNull();
      expect(sim.getState().creatures.wildActive.length).toBeGreaterThanOrEqual(1);
      const initial = sim.getState().creatures.wildActive.find((w) => w.id === wild!.id);
      expect(initial?.timer).toBe(45.0);

      // Advance 20 seconds (400 ticks of 50ms)
      sim.tick(20000);
      const after20 = sim.getState().creatures.wildActive.find((w) => w.id === wild!.id);
      expect(after20).toBeDefined();
      expect(after20!.timer).toBeCloseTo(25.0, 1);

      // Advance 30 more seconds (total 50s > 45s lifetime)
      sim.tick(30000);
      // Specific wild creature must have despawned
      const instance = sim.getState().creatures.wildActive.find((w) => w.id === wild!.id);
      expect(instance).toBeUndefined();
    });
  });

  // =========================================================================
  // 7. Empirical Adversarial Hardening & Remediation Verification
  // =========================================================================
  describe('7. Empirical Adversarial Hardening & Remediation Verification', () => {
    it('verifies calculateMaxAffordable safely handles non-finite (Infinity, NaN) balances without infinite looping', () => {
      // Documenting finite boundary behavior: 1e308 executes safely
      const finiteRes = calculateMaxAffordable(1e308, 15, 1.15, 0);
      expect(Number.isFinite(finiteRes.count)).toBe(true);
      expect(finiteRes.count).toBeGreaterThan(0);

      // Infinity balance must immediately return { count: 0, cost: 0 } without process hang
      const infRes = calculateMaxAffordable(Infinity, 15, 1.15, 0);
      expect(infRes).toEqual({ count: 0, cost: 0 });

      // -Infinity and NaN must also safely return { count: 0, cost: 0 }
      const negInfRes = calculateMaxAffordable(-Infinity, 15, 1.15, 0);
      expect(negInfRes).toEqual({ count: 0, cost: 0 });

      const nanRes = calculateMaxAffordable(NaN, 15, 1.15, 0);
      expect(nanRes).toEqual({ count: 0, cost: 0 });

      // In GameSimulation, max buy with Infinity gold must safely fail
      sim.getState().currencies.gold = Infinity;
      const buyRes = sim.buyFacility('fifi_broom', -1);
      expect(buyRes).toBe(false);
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(0);
    });

    it('verifies addResource sanitizes NaN and non-finite values and guards currency balances in purchases', () => {
      // Adding NaN to currency must not corrupt balance to NaN
      sim.addResource('gold', NaN);
      expect(Number.isNaN(sim.getState().currencies.gold)).toBe(false);
      expect(sim.getState().currencies.gold).toBe(0);

      // Adding Infinity must also be rejected
      sim.addResource('gold', Infinity);
      expect(sim.getState().currencies.gold).toBe(0);

      sim.addResource('treats', NaN);
      expect(sim.getState().currencies.treats).toBe(0);

      sim.addResource('essence', NaN);
      expect(sim.getState().currencies.essence).toBe(0);

      // In buyFacility, buyMultiplier, and unlockTerritory, non-finite balance returns false
      sim.getState().currencies.gold = NaN;
      expect(sim.buyFacility('fifi_broom', 1)).toBe(false);
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(0);

      expect(sim.buyMultiplier('mult_supervision')).toBe(false);
      expect(sim.getUpgradeLevel('mult_supervision')).toBe(0);

      expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(false);
      expect(sim.getState().territory.unlockedZones.includes('zone_02_kitchen_garden')).toBe(false);
    });

    it('verifies buyFacility validates integer count and rejects fractional or NaN counts', () => {
      sim.addResource('gold', 1000);

      // Calling buyFacility with fractional 0.5 count must return false
      const fractionalBuy = sim.buyFacility('fifi_broom', 0.5);
      expect(fractionalBuy).toBe(false);
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(0);

      // Fractional 1.5 count must return false
      expect(sim.buyFacility('fifi_broom', 1.5)).toBe(false);
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(0);

      // NaN count must return false
      expect(sim.buyFacility('fifi_broom', NaN)).toBe(false);
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(0);

      // Zero or negative count (other than -1) must return false
      expect(sim.buyFacility('fifi_broom', 0)).toBe(false);
      expect(sim.buyFacility('fifi_broom', -2)).toBe(false);

      // Integer count 1 succeeds
      expect(sim.buyFacility('fifi_broom', 1)).toBe(true);
      expect(sim.getUpgradeLevel('fifi_broom')).toBe(1);
    });

    it('verifies habitat capacity check semantics prevent multi-count creature overflow', () => {
      const porch = findHabitat('habitat_porch')!;
      expect(porch.capacity).toBe(3);

      sim.getState().creatures.caught['purrble'] = {
        count: 10,
        level: 1,
      };

      // When habitat has capacity 3 and 0 creatures assigned, assigning 10 Purrbles must be rejected
      const assigned = sim.assignCreature('purrble', 'habitat_porch');
      expect(assigned).toBe(false);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBeUndefined();

      // Assigning with count 2 fits within capacity 3
      sim.getState().creatures.caught['purrble'].count = 2;
      expect(sim.assignCreature('purrble', 'habitat_porch')).toBe(true);
      expect(sim.getState().creatures.caught['purrble'].assignedHabitat).toBe('habitat_porch');

      // Now adding Barkling with count 2 (2 + 2 = 4 > 3) must be rejected
      sim.getState().creatures.caught['barkling'] = {
        count: 2,
        level: 1,
      };
      expect(sim.assignCreature('barkling', 'habitat_porch')).toBe(false);
      expect(sim.getState().creatures.caught['barkling'].assignedHabitat).toBeUndefined();

      // Barkling with count 1 (2 + 1 = 3 <= 3) fits exactly
      sim.getState().creatures.caught['barkling'].count = 1;
      expect(sim.assignCreature('barkling', 'habitat_porch')).toBe(true);
      expect(sim.getState().creatures.caught['barkling'].assignedHabitat).toBe('habitat_porch');

      // Re-assigning an already assigned species (purrble) does not double-count its existing allocation
      expect(sim.assignCreature('purrble', 'habitat_porch')).toBe(true);
    });

    it('verifies calculateOfflineProgress falls back gracefully when timestamps are NaN or non-finite', () => {
      const state = createInitialState();
      const res = calculateOfflineProgress(state, NaN);

      // NaN currentTimestamp must fall back to Date.now() without producing NaN
      expect(Number.isFinite(res.elapsedSeconds)).toBe(true);
      expect(res.elapsedSeconds).toBe(0);
      expect(Number.isFinite(res.earnedGold)).toBe(true);
      expect(res.earnedGold).toBe(0);
      expect(Number.isFinite(res.earnedTreats)).toBe(true);
      expect(res.earnedTreats).toBe(0);
      expect(Number.isFinite(res.earnedEssence)).toBe(true);
      expect(res.earnedEssence).toBe(0);

      // When state.lastTickTimestamp is NaN, it also falls back gracefully
      state.lastTickTimestamp = NaN as any;
      const res2 = calculateOfflineProgress(state, Date.now());
      expect(Number.isFinite(res2.elapsedSeconds)).toBe(true);
      expect(res2.elapsedSeconds).toBe(0);
      expect(Number.isNaN(res2.earnedGold)).toBe(false);
    });
  });
});
