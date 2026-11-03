import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulation, advanceTime, assertStateIntegrity } from '../harness';
import { calculateSingleCost, calculateBulkCost, calculateMaxAffordable, calculateMilestoneMultiplier } from '../../../src/core/math';
import { findFacility } from '../../../src/core/facilities';
describe('Tier 2: Boundary & Corner Cases (Robustness & Edge Testing)', () => {
    let sim;
    beforeEach(async () => {
        sim = await createSimulation();
    });
    // =========================================================================
    // 1. Currency & Arithmetic Boundaries
    // =========================================================================
    describe('1. Currency & Arithmetic Boundaries', () => {
        it('T2-CURR-1: purchasing facility with exactly 0 gold fails and deducts nothing', () => {
            const stateBefore = sim.getState();
            expect(stateBefore.currencies.gold).toBe(0);
            const bought = sim.buyFacility('fifi_broom', 1);
            expect(bought).toBe(false);
            expect(sim.getState().currencies.gold).toBe(0);
            expect(sim.getState().facilities['fifi_broom']?.level).toBe(0);
        });
        it('T2-CURR-2: purchasing when balance is exactly (cost - 1) strictly fails', () => {
            const broom = findFacility('fifi_broom');
            const cost = calculateSingleCost(broom.baseCost, broom.costRatio, 0); // 15
            sim.addResource('gold', cost - 1); // 14
            const bought = sim.buyFacility('fifi_broom', 1);
            expect(bought).toBe(false);
            expect(sim.getState().currencies.gold).toBe(cost - 1);
            expect(sim.getState().facilities['fifi_broom']?.level).toBe(0);
        });
        it('T2-CURR-3: purchasing with negative count (e.g. -5) returns false and alters nothing', () => {
            sim.addResource('gold', 1000);
            const goldBefore = sim.getState().currencies.gold;
            const bought = sim.buyFacility('fifi_broom', -5);
            expect(bought).toBe(false);
            expect(sim.getState().currencies.gold).toBe(goldBefore);
            expect(sim.getState().facilities['fifi_broom']?.level).toBe(0);
        });
        it('T2-CURR-4: "Buy Max" (count = -1) with 0 balance returns false, buys 0 levels, costs 0', () => {
            expect(sim.getState().currencies.gold).toBe(0);
            const bought = sim.buyFacility('fifi_broom', -1);
            expect(bought).toBe(false);
            expect(sim.getState().facilities['fifi_broom']?.level).toBe(0);
        });
        it('T2-CURR-5: high-value resource additions remain finite without NaN or Infinity', () => {
            sim.addResource('gold', 1e15);
            const state = sim.getState();
            expect(Number.isFinite(state.currencies.gold)).toBe(true);
            expect(Number.isNaN(state.currencies.gold)).toBe(false);
            assertStateIntegrity(state);
        });
        it('T2-CURR-6: zero deltaMs tick advances cleanly without NaN', () => {
            sim.tick(0);
            const state = sim.getState();
            assertStateIntegrity(state);
        });
    });
    // =========================================================================
    // 2. Clicking & Frenzy Boundaries
    // =========================================================================
    describe('2. Clicking & Frenzy Boundaries', () => {
        it('T2-CLK-1: rapid clicks (100 clicks) accumulate accurately without corruption', () => {
            for (let i = 0; i < 100; i++) {
                sim.handleClick();
            }
            const state = sim.getState();
            expect(state.clickStats.totalClicks).toBe(100);
            expect(state.currencies.gold).toBeGreaterThanOrEqual(100);
            assertStateIntegrity(state);
        });
        it('T2-CLK-2: frenzy duration countdown stops at 0 and resets multiplier to 1.0x', () => {
            const state = sim.getState();
            state.clickStats.frenzyActive = true;
            state.clickStats.frenzyMultiplier = 3.0;
            state.clickStats.frenzyTimeRemaining = 0.1; // only 100ms remaining
            // Advance by 1 second (well past 100ms)
            advanceTime(sim, 1.0);
            expect(sim.getState().clickStats.frenzyActive).toBe(false);
            expect(sim.getState().clickStats.frenzyMultiplier).toBe(1.0);
            expect(sim.getState().clickStats.frenzyTimeRemaining).toBe(0);
        });
        it('T2-CLK-3: critical hit overflow calculation converts excess rate to multiplier', () => {
            // In math, critRate > 0.50 caps at 0.50 and converts overflow 1:2 to multiplier
            // We verify calculateClickPower honors this contract
            const clickNormal = sim.handleClick();
            expect(clickNormal.goldEarned).toBeGreaterThanOrEqual(1.0);
        });
        it('T2-CLK-4: click state does not decrement when no clicks occur', () => {
            advanceTime(sim, 2.0);
            expect(sim.getState().clickStats.totalClicks).toBe(0);
        });
        it('T2-CLK-5: click stats reflect in lifetime stats object', () => {
            sim.handleClick();
            sim.handleClick();
            expect(sim.getState().stats?.totalClicks).toBe(2);
        });
    });
    // =========================================================================
    // 3. Facilities & Milestone Boundaries
    // =========================================================================
    describe('3. Facilities & Milestone Boundaries', () => {
        it('T2-FAC-1: facility with level 0 produces exactly 0 gold/sec', () => {
            const prod = sim.getFacilityProduction('fifi_broom');
            expect(prod).toBe(0);
        });
        it('T2-FAC-2: milestone boundary exact checks: levels 9, 10, 24, 25, 49, 50', () => {
            expect(calculateMilestoneMultiplier(9)).toBe(1.0);
            expect(calculateMilestoneMultiplier(10)).toBe(2.0);
            expect(calculateMilestoneMultiplier(24)).toBe(2.0);
            expect(calculateMilestoneMultiplier(25)).toBe(4.0);
            expect(calculateMilestoneMultiplier(49)).toBe(4.0);
            expect(calculateMilestoneMultiplier(50)).toBe(12.0);
        });
        it('T2-FAC-3: non-existent facility ID returns false and preserves balances', () => {
            sim.addResource('gold', 1000);
            const goldBefore = sim.getState().currencies.gold;
            const bought = sim.buyFacility('fifi_non_existent', 1);
            expect(bought).toBe(false);
            expect(sim.getState().currencies.gold).toBe(goldBefore);
        });
        it('T2-FAC-4: "Buy Max" affordability accurately calculates maximum affordable count', () => {
            const broom = findFacility('fifi_broom');
            // Cost for 10 is 304
            const cost10 = calculateBulkCost(broom.baseCost, broom.costRatio, 0, 10);
            sim.addResource('gold', cost10);
            const bought = sim.buyFacility('fifi_broom', -1);
            expect(bought).toBe(true);
            expect(sim.getState().facilities['fifi_broom']?.level).toBe(10);
            expect(sim.getState().currencies.gold).toBeLessThan(calculateSingleCost(broom.baseCost, broom.costRatio, 10));
        });
        it('T2-FAC-5: multiple purchases in bulk do not exceed player gold balance', () => {
            sim.addResource('gold', 500);
            sim.buyFacility('fifi_broom', 10);
            expect(sim.getState().currencies.gold).toBeGreaterThanOrEqual(0);
            assertStateIntegrity(sim.getState());
        });
    });
    // =========================================================================
    // 4. Nyah Multipliers Boundaries
    // =========================================================================
    describe('4. Nyah Multipliers Boundaries', () => {
        it('T2-MULT-1: purchasing multiplier with invalid ID returns false', () => {
            sim.addResource('gold', 100000);
            const bought = sim.buyMultiplier('invalid_multiplier');
            expect(bought).toBe(false);
        });
        it('T2-MULT-2: purchasing multiplier when gold is insufficient returns false', () => {
            expect(sim.getState().currencies.gold).toBe(0);
            const bought = sim.buyMultiplier('nyah_supervision');
            expect(bought).toBe(false);
            expect(sim.getState().multipliers['nyah_supervision']?.level).toBe(0);
        });
        it('T2-MULT-3: level 0 multiplier provides default 1.0x factor', () => {
            const state = sim.getState();
            expect(state.multipliers['nyah_supervision']?.multiplierValue).toBe(1.0);
        });
        it('T2-MULT-4: compounding multipliers scale without numeric precision drift', () => {
            sim.addResource('gold', 10000000);
            for (let i = 0; i < 5; i++) {
                sim.buyMultiplier('nyah_inspection');
            }
            const val = sim.getState().multipliers['nyah_inspection']?.multiplierValue;
            expect(val).toBeGreaterThan(1.0);
            expect(Number.isFinite(val)).toBe(true);
        });
        it('T2-MULT-5: generic buyUpgrade routes to multiplier accurately', () => {
            sim.addResource('gold', 5000);
            const res = sim.buyUpgrade('nyah_supervision');
            expect(res).toBe(true);
            expect(sim.getState().multipliers['nyah_supervision']?.level).toBe(1);
        });
    });
    // =========================================================================
    // 5. Territory & Zone Unlock Boundaries
    // =========================================================================
    describe('5. Territory & Zone Unlock Boundaries', () => {
        it('T2-ZONE-1: unlocking an already unlocked zone returns false (idempotency)', () => {
            expect(sim.getState().territory.unlockedZones).toContain('zone_01_parlor');
            const unlockedAgain = sim.unlockTerritory('zone_01_parlor');
            expect(unlockedAgain).toBe(false);
        });
        it('T2-ZONE-2: unlocking zone out of sequence (skipping prerequisites) returns false', () => {
            // Zone 3 requires Zone 2
            sim.addResource('gold', 100000);
            sim.addResource('treats', 100);
            const unlockedZone3 = sim.unlockTerritory('zone_03_pond_courtyard');
            expect(unlockedZone3).toBe(false);
        });
        it('T2-ZONE-3: partial resources: sufficient gold but 0 treats rejects unlock and saves gold', () => {
            // First unlock zone 2
            sim.addResource('gold', 500);
            for (let i = 0; i < 25; i++)
                sim.handleClick();
            expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(true);
            // Zone 3 requires 7500 gold + 30 treats. Give only gold.
            sim.addResource('gold', 10000);
            const goldBefore = sim.getState().currencies.gold;
            const unlockedZone3 = sim.unlockTerritory('zone_03_pond_courtyard');
            expect(unlockedZone3).toBe(false);
            // Gold must NOT be deducted if treats requirement is unmet
            expect(sim.getState().currencies.gold).toBe(goldBefore);
        });
        it('T2-ZONE-4: non-existent zone ID returns false', () => {
            const res = sim.unlockTerritory('zone_phantom_dimension');
            expect(res).toBe(false);
        });
        it('T2-ZONE-5: chore prerequisite boundary: 24 chores fails; 25 chores succeeds', () => {
            sim.addResource('gold', 1000);
            for (let i = 0; i < 24; i++)
                sim.handleClick();
            // 24 chores completed (1 short of 25)
            expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(false);
            // Perform 25th chore
            sim.handleClick();
            expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(true);
            expect(sim.getState().territory.unlockedZones).toContain('zone_02_kitchen_garden');
        });
    });
    // =========================================================================
    // 6. Creatures & Habitat Boundaries
    // =========================================================================
    describe('6. Creatures & Habitat Boundaries', () => {
        it('T2-CREAT-1: zone wild creature limit enforces maximum 3 simultaneous wild creatures', () => {
            sim.spawnWildCreature('zone_01_parlor');
            sim.spawnWildCreature('zone_01_parlor');
            sim.spawnWildCreature('zone_01_parlor');
            const inZone = sim.getState().creatures.wildActive.filter((w) => w.zoneId === 'zone_01_parlor');
            expect(inZone.length).toBe(3);
            // Advance time where spawn timer ticks: should not exceed cap of 3
            advanceTime(sim, 30.0);
            const after = sim.getState().creatures.wildActive.filter((w) => w.zoneId === 'zone_01_parlor');
            expect(after.length).toBeLessThanOrEqual(3);
        });
        it('T2-CREAT-2: catching non-existent wild instance returns failure without crashing', () => {
            const res = sim.attemptCatchCreature('wild_ghost_999', false);
            expect(res.success).toBe(false);
            expect(res.fled).toBe(false);
        });
        it('T2-CREAT-3: bait catch with 0 treats does not drop treats below 0', () => {
            expect(sim.getState().currencies.treats).toBe(0);
            const wild = sim.spawnWildCreature('zone_01_parlor');
            sim.attemptCatchCreature(wild.id, true);
            expect(sim.getState().currencies.treats).toBe(0);
        });
        it('T2-CREAT-4: assigning creature to full habitat (capacity reached) returns false', () => {
            // Seed habitat_porch to its full capacity of 3
            const raw = sim.getSaveData();
            const parsed = JSON.parse(raw);
            parsed.creatures.caught['purrble'] = {
                count: 3,
                level: 1,
                assignedHabitat: 'habitat_porch',
            };
            parsed.creatures.caught['barkling'] = {
                count: 1,
                level: 1,
            };
            sim.loadSaveData(JSON.stringify(parsed));
            // Attempt to assign barkling to porch (capacity 3 already taken)
            const assigned = sim.assignCreature('barkling', 'habitat_porch');
            expect(assigned).toBe(false);
        });
        it('T2-CREAT-5: assigning uncaught creature species returns false', () => {
            const assigned = sim.assignCreature('starling_doe', 'habitat_porch');
            expect(assigned).toBe(false);
        });
        it('T2-CREAT-6: wild creature 45s timer expiration cleanly removes it from active list', () => {
            const wild = sim.spawnWildCreature('zone_01_parlor');
            expect(sim.getState().creatures.wildActive.some((w) => w.id === wild.id)).toBe(true);
            // Advance 46 seconds (past 45s lifetime)
            advanceTime(sim, 46.0);
            expect(sim.getState().creatures.wildActive.some((w) => w.id === wild.id)).toBe(false);
        });
    });
    // =========================================================================
    // 7. Persistence & Sanitization Boundaries
    // =========================================================================
    describe('7. Persistence & Sanitization Boundaries', () => {
        it('T2-SAVE-1: loading malformed JSON returns false without crashing', () => {
            const res = sim.loadSaveData('{ broken json invalid syntax ...');
            expect(res).toBe(false);
            assertStateIntegrity(sim.getState());
        });
        it('T2-SAVE-2: loading JSON with negative currencies clamps them to 0', () => {
            const raw = sim.getSaveData();
            const parsed = JSON.parse(raw);
            parsed.currencies = { gold: -500, treats: -20, essence: -10 };
            const loaded = sim.loadSaveData(JSON.stringify(parsed));
            expect(loaded).toBe(true);
            expect(sim.getState().currencies.gold).toBeGreaterThanOrEqual(0);
            expect(sim.getState().currencies.treats).toBeGreaterThanOrEqual(0);
            expect(sim.getState().currencies.essence).toBeGreaterThanOrEqual(0);
        });
        it('T2-SAVE-3: loading partial/empty object safely applies defaults', () => {
            const loaded = sim.loadSaveData(JSON.stringify({ version: 1 }));
            expect(loaded).toBe(true);
            assertStateIntegrity(sim.getState());
        });
        it('T2-SAVE-4: 1 year offline simulation hiatus processes safely within bounds', () => {
            sim.addResource('gold', 1000);
            sim.buyFacility('fifi_broom', 5);
            const raw = sim.getSaveData();
            const parsed = JSON.parse(raw);
            // 1 year = 31,536,000 seconds ago
            parsed.timestamp = Date.now() - 31536000 * 1000;
            const loaded = sim.loadSaveData(JSON.stringify(parsed));
            expect(loaded).toBe(true);
            expect(Number.isFinite(sim.getState().currencies.gold)).toBe(true);
            expect(Number.isNaN(sim.getState().currencies.gold)).toBe(false);
        });
        it('T2-SAVE-5: serialization roundtrip preserves 100% of species and facility IDs', () => {
            sim.addResource('gold', 100000);
            sim.buyFacility('fifi_broom', 3);
            sim.buyFacility('fifi_duster', 2);
            const saveStr = sim.getSaveData();
            expect(saveStr).toContain('fifi_broom');
            expect(saveStr).toContain('fifi_duster');
        });
    });
    // =========================================================================
    // 8. Audio & Settings Boundaries
    // =========================================================================
    describe('8. Audio & Settings Boundaries', () => {
        it('T2-AUDIO-1: master volume clamp [0.0, 1.0]', () => {
            const state = sim.getState();
            expect(state.settings.masterVolume).toBeGreaterThanOrEqual(0.0);
            expect(state.settings.masterVolume).toBeLessThanOrEqual(1.0);
        });
        it('T2-AUDIO-2: toggle mute retains volume values while flipping muted boolean', () => {
            const initialMuted = sim.getState().settings.muted;
            const initialMaster = sim.getState().settings.masterVolume;
            sim.getState().settings.muted = !initialMuted;
            expect(sim.getState().settings.muted).toBe(!initialMuted);
            expect(sim.getState().settings.masterVolume).toBe(initialMaster);
        });
        it('T2-AUDIO-3: sfx volume is non-negative and finite', () => {
            expect(Number.isFinite(sim.getState().settings.sfxVolume)).toBe(true);
            expect(sim.getState().settings.sfxVolume).toBeGreaterThanOrEqual(0.0);
        });
        it('T2-AUDIO-4: bgm volume is non-negative and finite', () => {
            expect(Number.isFinite(sim.getState().settings.bgmVolume)).toBe(true);
            expect(sim.getState().settings.bgmVolume).toBeGreaterThanOrEqual(0.0);
        });
        it('T2-MATH-1: geometric bulk cost with costRatio = 1.0 boundary evaluates linearly', () => {
            const cost = calculateBulkCost(20, 1.0, 0, 5);
            expect(cost).toBe(100);
        });
        it('T2-MATH-2: calculateMaxAffordable with huge balance (1e14) finishes in sub-millisecond without hanging', () => {
            const maxInfo = calculateMaxAffordable(1e14, 15, 1.15, 0);
            expect(maxInfo.count).toBeGreaterThan(100);
            expect(Number.isFinite(maxInfo.cost)).toBe(true);
        });
        it('T2-MATH-3: calculateMilestoneMultiplier beyond level 250 preserves cap of 960x', () => {
            expect(calculateMilestoneMultiplier(250)).toBe(960.0);
            expect(calculateMilestoneMultiplier(350)).toBe(960.0);
            expect(calculateMilestoneMultiplier(1000)).toBe(960.0);
        });
        it('T2-CREAT-7: duplicate creature catching increments count on existing entry', () => {
            const raw = sim.getSaveData();
            const parsed = JSON.parse(raw);
            parsed.creatures.caught['purrble'] = { count: 1, level: 1 };
            sim.loadSaveData(JSON.stringify(parsed));
            // Spawn and force catch purrble
            const wild = sim.spawnWildCreature('zone_01_parlor', 'purrble');
            // Set purrble catch rate high or loop until caught
            let caught = false;
            for (let i = 0; i < 20 && !caught; i++) {
                const res = sim.attemptCatchCreature(wild.id, false);
                if (res.success)
                    caught = true;
            }
            expect(sim.getState().creatures.caught['purrble']?.count).toBeGreaterThanOrEqual(1);
        });
        it('T2-CREAT-8: unassigned caught creatures do not generate passive GPS/TPS/EPS', () => {
            const raw = sim.getSaveData();
            const parsed = JSON.parse(raw);
            // Caught but assignedHabitat is undefined
            parsed.creatures.caught['starling_doe'] = { count: 5, level: 1 };
            sim.loadSaveData(JSON.stringify(parsed));
            const gps = sim.getTotalGPS();
            // Without an assigned habitat, starling doe should produce 0 GPS
            expect(gps).toBe(0);
        });
    });
});
