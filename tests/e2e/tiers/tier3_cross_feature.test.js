import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulation, advanceTime, assertStateIntegrity } from '../harness';
import { findFacility } from '../../../src/core/facilities';
describe('Tier 3: Cross-Feature Combinations (Pairwise & System Interactions)', () => {
    let sim;
    beforeEach(async () => {
        sim = await createSimulation();
    });
    // =========================================================================
    // 1. Clicking + Facilities Interaction
    // =========================================================================
    it('T3-PAIR-01: clicking scales dynamically with 2% of passive facility GPS', () => {
        // Initial click with 0 facilities
        const initialClick = sim.handleClick();
        expect(initialClick.goldEarned).toBe(1.0);
        // Buy facilities to generate significant GPS
        sim.addResource('gold', 100000);
        sim.buyFacility('fifi_broom', 25); // Level 25 milestone gives 4x multiplier
        sim.buyFacility('fifi_duster', 10); // Level 10 milestone gives 2x multiplier
        const gps = sim.getTotalGPS();
        expect(gps).toBeGreaterThan(100);
        // Active click should now incorporate 2% of GPS
        const boostedClick = sim.handleClick();
        expect(boostedClick.goldEarned).toBeGreaterThan(initialClick.goldEarned);
        expect(boostedClick.goldEarned).toBeGreaterThanOrEqual(1.0 + 0.02 * gps);
    });
    // =========================================================================
    // 2. Clicking + Frenzy + Demands Multiplier
    // =========================================================================
    it('T3-PAIR-02: Tsundere Frenzy multiplies with Nyah’s Aristocratic Demands multiplicatively', () => {
        sim.addResource('gold', 500000);
        // Buy 2 levels of Aristocratic Demands (click power boost)
        sim.buyMultiplier('nyah_demands');
        sim.buyMultiplier('nyah_demands');
        const state = sim.getState();
        state.clickStats.frenzyActive = true;
        state.clickStats.frenzyMultiplier = 3.0;
        state.clickStats.frenzyTimeRemaining = 15.0;
        const res = sim.handleClick();
        // Demands provides multiplier, Frenzy provides 3x
        expect(res.goldEarned).toBeGreaterThanOrEqual(3.0);
        assertStateIntegrity(sim.getState());
    });
    // =========================================================================
    // 3. Facilities + Bulk Buy Crossing Multiple Milestones
    // =========================================================================
    it('T3-PAIR-03: purchasing 50 levels in bulk crosses levels 10, 25, 50 milestones atomically', () => {
        const broom = findFacility('fifi_broom');
        sim.addResource('gold', 10000000);
        const bought = sim.buyFacility('fifi_broom', 50);
        expect(bought).toBe(true);
        expect(sim.getState().facilities['fifi_broom']?.level).toBe(50);
        // At level 50, milestone multiplier is 12x
        // Production = 50 * 1.0 * 12 = 600 gold/sec
        const prod = sim.getFacilityProduction('fifi_broom');
        expect(prod).toBe(600);
    });
    // =========================================================================
    // 4. Facilities + Secondary Currency + Territory Unlocks
    // =========================================================================
    it('T3-PAIR-04: kitchen stove generates treats that fund Zone 3 courtyard unlock', () => {
        // Unlock Zone 2 first
        sim.addResource('gold', 500);
        for (let i = 0; i < 25; i++)
            sim.handleClick();
        expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(true);
        // Buy kitchen stove (which produces treats)
        sim.addResource('gold', 2000000);
        const boughtKitchen = sim.buyFacility('fifi_kitchen', 5);
        expect(boughtKitchen).toBe(true);
        // Advance 60 seconds of simulation time to accumulate treats
        advanceTime(sim, 60.0);
        expect(sim.getState().currencies.treats).toBeGreaterThan(0);
        // Grant remaining requirements for Zone 3 (requires 7500 gold + 30 treats)
        sim.addResource('gold', 10000);
        sim.addResource('treats', 30);
        const unlockedZone3 = sim.unlockTerritory('zone_03_pond_courtyard');
        expect(unlockedZone3).toBe(true);
        expect(sim.getState().territory.unlockedZones).toContain('zone_03_pond_courtyard');
    });
    // =========================================================================
    // 5. Territory Unlocks + Wild Creature Spawning Pools
    // =========================================================================
    it('T3-PAIR-05: unlocking outdoor zones expands wild creature spawning pools dynamically', () => {
        // In starter Zone 1, only Zone 1 creatures can spawn
        const wild1 = sim.spawnWildCreature('zone_01_parlor');
        expect(wild1.speciesId).toBe('purrble');
        // Unlock Zone 2
        sim.addResource('gold', 500);
        for (let i = 0; i < 25; i++)
            sim.handleClick();
        sim.unlockTerritory('zone_02_kitchen_garden');
        // Now Zone 2 creatures can spawn (barkling or mooshrum)
        const wild2 = sim.spawnWildCreature('zone_02_kitchen_garden');
        expect(['barkling', 'mooshrum']).toContain(wild2.speciesId);
    });
    // =========================================================================
    // 6. Wild Spawning + Bait Catching + Inventory Flow
    // =========================================================================
    it('T3-PAIR-06: full creature catching loop with treat deduction and roster update', () => {
        sim.addResource('treats', 10);
        const initialTreats = sim.getState().currencies.treats;
        const wild = sim.spawnWildCreature('zone_01_parlor', 'purrble');
        expect(wild).toBeDefined();
        const catchResult = sim.attemptCatchCreature(wild.id, true);
        // 1 treat must be deducted
        expect(sim.getState().currencies.treats).toBe(initialTreats - 1);
        expect(sim.getState().creatures.wildActive.some((w) => w.id === wild.id)).toBe(false);
        if (catchResult.success) {
            expect(sim.getState().creatures.caught['purrble']?.count).toBeGreaterThanOrEqual(1);
        }
    });
    // =========================================================================
    // 7. Caught Creature + Habitat Assignment + Production Boost
    // =========================================================================
    it('T3-PAIR-07: assigning caught creature to habitat accelerates estate output', () => {
        const gpsInitial = sim.getTotalGPS();
        // Seed caught creature assigned to Porch Basket
        const raw = sim.getSaveData();
        const parsed = JSON.parse(raw);
        parsed.creatures.caught['purrble'] = {
            count: 2,
            level: 1,
            assignedHabitat: 'habitat_porch',
        };
        sim.loadSaveData(JSON.stringify(parsed));
        const gpsWithCreature = sim.getTotalGPS();
        // 2 Purrbles produce 2.0 gold/sec
        expect(gpsWithCreature).toBeGreaterThanOrEqual(gpsInitial + 2.0);
    });
    // =========================================================================
    // 8. Nyah Supervision + Fifi Facilities Compounding
    // =========================================================================
    it('T3-PAIR-08: Nyah’s Supervision boosts all Fifi chore outputs simultaneously', () => {
        sim.addResource('gold', 100000);
        sim.buyFacility('fifi_broom', 10);
        sim.buyFacility('fifi_duster', 5);
        const gpsBefore = sim.getTotalGPS();
        // Buy 2 levels of Supervision (+10% chore boost per level)
        sim.buyMultiplier('nyah_supervision');
        sim.buyMultiplier('nyah_supervision');
        const gpsAfter = sim.getTotalGPS();
        expect(gpsAfter).toBeGreaterThan(gpsBefore);
    });
    // =========================================================================
    // 9. Nyah Inspection + Territory Multipliers Synergy
    // =========================================================================
    it('T3-PAIR-09: global inspection multiplier compounds with territory bonuses', () => {
        sim.addResource('gold', 1000000);
        sim.buyFacility('fifi_broom', 10);
        const baseGps = sim.getTotalGPS();
        // Buy Inspection (+5% compounding)
        sim.buyMultiplier('nyah_inspection');
        const gpsWithInspection = sim.getTotalGPS();
        expect(gpsWithInspection).toBeGreaterThan(baseGps);
        // Unlock Zone 2 (adds 1.15x territory gold multiplier)
        for (let i = 0; i < 25; i++)
            sim.handleClick();
        sim.unlockTerritory('zone_02_kitchen_garden');
        const gpsWithBoth = sim.getTotalGPS();
        // Synergistic multiplication: (facilities * inspection) * territoryMult
        expect(gpsWithBoth).toBeGreaterThan(gpsWithInspection);
    });
    // =========================================================================
    // 10. Mid-Gameplay Save/Load Roundtrip with Complex State
    // =========================================================================
    it('T3-PAIR-10: complex state save/load roundtrip preserves all system interactions', async () => {
        sim.addResource('gold', 50000);
        sim.addResource('treats', 15);
        sim.addResource('essence', 50);
        sim.buyFacility('fifi_broom', 12);
        sim.buyFacility('fifi_duster', 6);
        sim.buyMultiplier('nyah_supervision');
        for (let i = 0; i < 25; i++)
            sim.handleClick();
        sim.unlockTerritory('zone_02_kitchen_garden');
        sim.spawnWildCreature('zone_02_kitchen_garden');
        const saveJson = sim.getSaveData();
        // Load into clean simulation
        const newSim = await createSimulation();
        const loaded = newSim.loadSaveData(saveJson);
        expect(loaded).toBe(true);
        const newState = newSim.getState();
        expect(newState.facilities['fifi_broom']?.level).toBe(12);
        expect(newState.facilities['fifi_duster']?.level).toBe(6);
        expect(newState.multipliers['nyah_supervision']?.level).toBe(1);
        expect(newState.territory.unlockedZones).toContain('zone_02_kitchen_garden');
        assertStateIntegrity(newState);
    });
    // =========================================================================
    // 11. Offline Catch-up + Royal Catnap Efficiency
    // =========================================================================
    it('T3-PAIR-11: 8 hours offline simulation honors passive rates and catnap efficiency', async () => {
        sim.addResource('gold', 100000);
        sim.buyFacility('fifi_broom', 20);
        sim.buyFacility('fifi_duster', 10);
        const saveStr = sim.getSaveData();
        const parsed = JSON.parse(saveStr);
        const initialGold = parsed.currencies.gold;
        // Simulate 8 hours offline (28,800 seconds)
        parsed.timestamp = Date.now() - 28800 * 1000;
        const newSim = await createSimulation();
        newSim.loadSaveData(JSON.stringify(parsed));
        expect(newSim.getState().currencies.gold).toBeGreaterThan(initialGold);
        assertStateIntegrity(newSim.getState());
    });
    // =========================================================================
    // 12. Full Integration Progression Loop
    // =========================================================================
    it('T3-PAIR-12: full end-to-end game loop: clicks -> broom -> treats -> catch -> boost', () => {
        // 1. Click to earn starter gold
        for (let i = 0; i < 15; i++) {
            sim.handleClick();
        }
        expect(sim.getState().currencies.gold).toBeGreaterThanOrEqual(15);
        // 2. Buy first Fifi Broom
        const boughtBroom = sim.buyFacility('fifi_broom', 1);
        expect(boughtBroom).toBe(true);
        // 3. Accumulate gold over 10 seconds of passive sweeping
        advanceTime(sim, 10.0);
        expect(sim.getState().currencies.gold).toBeGreaterThan(0);
        // 4. Spawn wild creature
        const wild = sim.spawnWildCreature('zone_01_parlor', 'purrble');
        expect(wild).toBeDefined();
        // 5. Catch creature
        const res = sim.attemptCatchCreature(wild.id, false);
        expect(typeof res.success).toBe('boolean');
        // State integrity guaranteed across all transitions
        assertStateIntegrity(sim.getState());
    });
    // =========================================================================
    // 13. Multiple Wild Creatures Roaming Across Multiple Zones
    // =========================================================================
    it('T3-PAIR-13: multiple wild creatures roaming across distinct outdoor zones concurrently', () => {
        for (let i = 0; i < 25; i++)
            sim.handleClick();
        sim.addResource('gold', 10000);
        sim.addResource('treats', 50);
        sim.unlockTerritory('zone_02_kitchen_garden');
        sim.unlockTerritory('zone_03_pond_courtyard');
        const w1 = sim.spawnWildCreature('zone_01_parlor', 'purrble');
        const w2 = sim.spawnWildCreature('zone_02_kitchen_garden', 'barkling');
        const w3 = sim.spawnWildCreature('zone_03_pond_courtyard', 'glimmerfin');
        const activeList = sim.getState().creatures.wildActive;
        expect(activeList.length).toBe(3);
        expect(activeList.map((w) => w.speciesId)).toContain('purrble');
        expect(activeList.map((w) => w.speciesId)).toContain('barkling');
        expect(activeList.map((w) => w.speciesId)).toContain('glimmerfin');
    });
    // =========================================================================
    // 14. Multi-Habitat Multi-Currency Passive Compounding
    // =========================================================================
    it('T3-PAIR-14: multi-habitat assignments generate simultaneous triple-currency yields', () => {
        for (let i = 0; i < 25; i++)
            sim.handleClick();
        sim.addResource('gold', 20000);
        sim.addResource('treats', 50);
        sim.unlockTerritory('zone_02_kitchen_garden');
        sim.unlockTerritory('zone_03_pond_courtyard');
        const raw = sim.getSaveData();
        const parsed = JSON.parse(raw);
        parsed.creatures.caught['purrble'] = { count: 1, level: 1, assignedHabitat: 'habitat_porch' };
        parsed.creatures.caught['barkling'] = { count: 1, level: 1, assignedHabitat: 'habitat_garden' };
        parsed.creatures.caught['glimmerfin'] = { count: 1, level: 1, assignedHabitat: 'habitat_pond' };
        sim.loadSaveData(JSON.stringify(parsed));
        const gps = sim.getTotalGPS();
        const tps = sim.getTotalTPS();
        const eps = sim.getTotalEPS();
        expect(gps).toBeGreaterThan(0);
        expect(tps).toBeGreaterThan(0);
        expect(eps).toBeGreaterThan(0);
    });
    // =========================================================================
    // 15. Simulation Reset Reverts Everything Cleanly
    // =========================================================================
    it('T3-PAIR-15: sim.reset() cleanly restores state to fresh start with 0 leaks', () => {
        sim.addResource('gold', 100000);
        sim.buyFacility('fifi_broom', 10);
        sim.spawnWildCreature('zone_01_parlor');
        sim.reset();
        const state = sim.getState();
        expect(state.currencies.gold).toBe(0);
        expect(state.facilities['fifi_broom']?.level).toBe(0);
        expect(state.creatures.wildActive.length).toBe(0);
        expect(state.territory.unlockedZones).toEqual(['zone_01_parlor']);
        assertStateIntegrity(state);
    });
    // =========================================================================
    // 16. Rapid Clicking During Frenzy
    // =========================================================================
    it('T3-PAIR-16: 50 active clicks during 15s frenzy accumulate properly with passive GPS', () => {
        sim.addResource('gold', 100000);
        sim.buyFacility('fifi_broom', 20);
        const state = sim.getState();
        state.clickStats.frenzyActive = true;
        state.clickStats.frenzyMultiplier = 3.0;
        state.clickStats.frenzyTimeRemaining = 15.0;
        const goldBefore = sim.getState().currencies.gold;
        for (let i = 0; i < 50; i++) {
            sim.handleClick();
        }
        expect(sim.getState().currencies.gold).toBeGreaterThan(goldBefore);
        expect(sim.getState().clickStats.totalClicks).toBeGreaterThanOrEqual(50);
    });
});
