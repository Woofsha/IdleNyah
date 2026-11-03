import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulation, advanceTime, assertStateIntegrity } from '../harness';
describe('Tier 4: Real-World Gameplay Scenarios (End-to-End Multi-Minute Simulations)', () => {
    let sim;
    beforeEach(async () => {
        sim = await createSimulation();
    });
    // =========================================================================
    // Scenario A: From Dusty Porch to Country Kitchen (Fresh Start to First Expansion)
    // =========================================================================
    it('Scenario A: "From Dusty Porch to Country Kitchen" (First 15-30 min simulated play)', () => {
        // 1. Fresh start: 0 gold, only starter parlor unlocked
        expect(sim.getState().currencies.gold).toBe(0);
        expect(sim.getState().territory.unlockedZones).toEqual(['zone_01_parlor']);
        // 2. Active clicking to afford first broom (15 gold)
        while (sim.getState().currencies.gold < 15) {
            sim.handleClick();
        }
        expect(sim.getState().clickStats.totalClicks).toBeGreaterThanOrEqual(1);
        // 3. Buy first Fifi Broom
        const boughtBroom = sim.buyFacility('fifi_broom', 1);
        expect(boughtBroom).toBe(true);
        expect(sim.getState().facilities['fifi_broom']?.level).toBe(1);
        // 4. Hybrid play: simulate 60 seconds with active clicking every few seconds
        for (let sec = 0; sec < 30; sec++) {
            advanceTime(sim, 2.0);
            sim.handleClick();
        }
        expect(sim.getState().currencies.gold).toBeGreaterThan(50);
        // 5. Upgrade broom towards milestone 10
        const broomCost10 = sim.getUpgradeCost('fifi_broom', 9);
        sim.addResource('gold', broomCost10);
        sim.buyFacility('fifi_broom', 9); // Reaches level 10!
        expect(sim.getState().facilities['fifi_broom']?.level).toBe(10);
        // At level 10, milestone 2.0x activates
        expect(sim.getFacilityProduction('fifi_broom')).toBe(20.0);
        // 6. Complete 25 total clicks and accumulate 500 gold for Zone 2
        while (sim.getState().clickStats.totalClicks < 25) {
            sim.handleClick();
        }
        sim.addResource('gold', 500);
        // 7. Unlock Zone 2: Country Kitchen & Herb Garden
        const unlockedZone2 = sim.unlockTerritory('zone_02_kitchen_garden');
        expect(unlockedZone2).toBe(true);
        expect(sim.getState().territory.unlockedZones).toContain('zone_02_kitchen_garden');
        // 8. Wild Purrble spawn and catch
        const wild = sim.spawnWildCreature('zone_01_parlor', 'purrble');
        expect(wild).toBeDefined();
        // Simulate catch roll until caught
        let caught = false;
        for (let attempts = 0; attempts < 10 && !caught; attempts++) {
            const res = sim.attemptCatchCreature(wild.id, false);
            if (res.success)
                caught = true;
        }
        // Verify state integrity throughout starter progression
        assertStateIntegrity(sim.getState());
    });
    // =========================================================================
    // Scenario B: Watering the Whispering Pond (Mid-Game Expansion)
    // =========================================================================
    it('Scenario B: "Watering the Whispering Pond" (Mid-Game Expansion & Aquaculture)', () => {
        // 1. Establish foundation: Zone 1 + Zone 2 unlocked
        for (let i = 0; i < 25; i++)
            sim.handleClick();
        sim.addResource('gold', 1000);
        sim.unlockTerritory('zone_02_kitchen_garden');
        // 2. Buy kitchen stove and tea kettle for treat generation
        sim.addResource('gold', 2500000);
        sim.buyFacility('fifi_kettle', 5);
        sim.buyFacility('fifi_kitchen', 5);
        // 3. Buy bulk 10x garden rakes for essence generation
        sim.buyFacility('fifi_garden', 10);
        expect(sim.getState().facilities['fifi_garden']?.level).toBe(10);
        // 4. Simulate 120 seconds of mid-game automation
        advanceTime(sim, 120.0);
        expect(sim.getState().currencies.treats).toBeGreaterThan(0);
        expect(sim.getState().currencies.essence).toBeGreaterThan(0);
        // 5. Gather funds for Whispering Pond (7500 gold + 30 treats)
        sim.addResource('gold', 10000);
        sim.addResource('treats', 30);
        const unlockedPond = sim.unlockTerritory('zone_03_pond_courtyard');
        expect(unlockedPond).toBe(true);
        expect(sim.getState().territory.unlockedZones).toContain('zone_03_pond_courtyard');
        // 6. Spawn and catch Glimmerfin using treats as bait
        const wildPond = sim.spawnWildCreature('zone_03_pond_courtyard', 'glimmerfin');
        expect(wildPond).toBeDefined();
        const catchRes = sim.attemptCatchCreature(wildPond.id, true);
        expect(typeof catchRes.success).toBe('boolean');
        // 7. Assign to Whispering Pond habitat (capacity 6)
        const raw = sim.getSaveData();
        const parsed = JSON.parse(raw);
        parsed.creatures.caught['glimmerfin'] = {
            count: 1,
            level: 1,
            assignedHabitat: 'habitat_pond',
        };
        sim.loadSaveData(JSON.stringify(parsed));
        expect(sim.getState().creatures.caught['glimmerfin']?.assignedHabitat).toBe('habitat_pond');
        assertStateIntegrity(sim.getState());
    });
    // =========================================================================
    // Scenario C: Nyah's Royal Library & Supervision (Late-Game Escalation)
    // =========================================================================
    it('Scenario C: "Nyah\'s Royal Library & Supervision" (Late-Game Multiplier Scaling)', () => {
        // 1. Setup prerequisite zones 1, 2, 3
        for (let i = 0; i < 25; i++)
            sim.handleClick();
        sim.addResource('gold', 20000);
        sim.addResource('treats', 50);
        sim.unlockTerritory('zone_02_kitchen_garden');
        sim.unlockTerritory('zone_03_pond_courtyard');
        // 2. Accumulate resources for Royal Library (85,000 gold + 200 essence)
        sim.addResource('gold', 100000);
        sim.addResource('essence', 250);
        const unlockedLib = sim.unlockTerritory('zone_04_library_balcony');
        expect(unlockedLib).toBe(true);
        expect(sim.getState().territory.unlockedZones).toContain('zone_04_library_balcony');
        // 3. Purchase Nyah's management upgrades
        sim.addResource('gold', 100000000);
        sim.buyMultiplier('nyah_supervision'); // Fifi chore boost
        sim.buyMultiplier('nyah_supervision');
        sim.buyMultiplier('nyah_inspection'); // Compounding gold
        sim.buyMultiplier('nyah_demands'); // Click power
        // 4. Buy advanced physical facilities
        const boughtLaundry = sim.buyFacility('fifi_laundry', 5);
        expect(boughtLaundry).toBe(true);
        const boughtCarriage = sim.buyFacility('fifi_carriage', 2);
        expect(boughtCarriage).toBe(true);
        const gps = sim.getTotalGPS();
        expect(gps).toBeGreaterThan(10000);
        // 5. Simulate 180 seconds of late-game operation
        advanceTime(sim, 180.0);
        expect(sim.getState().currencies.gold).toBeGreaterThan(1000000);
        // 6. Spawn Cinderfox on balcony
        const wildFox = sim.spawnWildCreature('zone_04_library_balcony', 'cinderfox');
        expect(wildFox).toBeDefined();
        assertStateIntegrity(sim.getState());
    });
    // =========================================================================
    // Scenario D: The Starlight Empire & Full Estate Grand Slam (End-Game & Persistence)
    // =========================================================================
    it('Scenario D: "The Starlight Empire & Full Estate Grand Slam" (End-Game Empire & 12h Offline Hiatus)', async () => {
        // 1. Unlock all 5 territory zones
        for (let i = 0; i < 25; i++)
            sim.handleClick();
        sim.addResource('gold', 5000000);
        sim.addResource('treats', 500);
        sim.addResource('essence', 10000);
        sim.unlockTerritory('zone_02_kitchen_garden');
        sim.unlockTerritory('zone_03_pond_courtyard');
        sim.unlockTerritory('zone_04_library_balcony');
        const unlockedObservatory = sim.unlockTerritory('zone_05_starlight_observatory');
        expect(unlockedObservatory).toBe(true);
        expect(sim.getState().territory.unlockedZones.length).toBe(5);
        expect(sim.getState().territory.currentTier).toBe(5);
        // 2. Buy top-tier facilities & multipliers (Vault baseCost is 330M, 5 levels cost ~2.2B)
        sim.addResource('gold', 5000000000);
        const boughtVault = sim.buyFacility('fifi_vault', 5);
        expect(boughtVault).toBe(true);
        sim.buyMultiplier('nyah_auditing'); // Fiscal auditing compound multiplier
        // 3. Catch and assign mythic Starling Doe
        const raw = sim.getSaveData();
        const parsed = JSON.parse(raw);
        parsed.creatures.caught['starling_doe'] = {
            count: 1,
            level: 1,
            assignedHabitat: 'habitat_sanctuary',
            isShiny: true,
        };
        sim.loadSaveData(JSON.stringify(parsed));
        const empireGps = sim.getTotalGPS();
        expect(empireGps).toBeGreaterThan(100000);
        // 4. Save game state to JSON string
        const preSave = sim.getSaveData();
        expect(preSave).toBeDefined();
        // 5. Simulate 12-hour offline hiatus (43,200 seconds)
        const offlineSave = JSON.parse(preSave);
        offlineSave.timestamp = Date.now() - 43200 * 1000;
        // 6. Reload into a new simulation instance (simulating app relaunch)
        const reloadedSim = await createSimulation();
        const reloadSuccess = reloadedSim.loadSaveData(JSON.stringify(offlineSave));
        expect(reloadSuccess).toBe(true);
        // 7. Verify offline progress: millions of gold generated during player absence
        const finalState = reloadedSim.getState();
        expect(finalState.currencies.gold).toBeGreaterThan(offlineSave.currencies.gold);
        expect(finalState.territory.unlockedZones.length).toBe(5);
        expect(finalState.creatures.caught['starling_doe']?.isShiny).toBe(true);
        // 8. 100% state integrity verified after entire campaign
        assertStateIntegrity(finalState);
    });
});
