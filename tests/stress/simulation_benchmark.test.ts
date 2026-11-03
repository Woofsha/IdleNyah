// tests/stress/simulation_benchmark.test.ts
import { describe, it, expect } from 'vitest';
import {
  GameSimulation,
  getAllZones,
  calculateOfflineProgress,
} from '../../src/core';

describe('Empirical Simulation Stress Benchmark', () => {
  it('executes 100,000 active clicks and validates statistics distribution', () => {
    const sim = new GameSimulation({ seed: 'click-bench-100k' });
    const clicks = 100000;
    let crits = 0;
    let frenzies = 0;
    let treats = 0;
    let essence = 0;

    const t0 = Date.now();
    for (let i = 0; i < clicks; i++) {
      const res = sim.handleClick();
      if (res.isCrit) crits++;
      if (res.frenzyTriggered) frenzies++;
      if (res.treatDropped) treats++;
      if (res.essenceDropped) essence++;

      // Advance simulation tick by 100ms every 10 clicks (simulating 100 clicks/sec with realistic timer decay)
      if (i % 10 === 0) {
        sim.tick(100);
      }
    }
    const durationMs = Date.now() - t0;

    console.log(`[BENCHMARK] 100k Clicks executed in ${durationMs}ms`);
    console.log(`[BENCHMARK] Crits: ${crits} (${(crits / clicks * 100).toFixed(2)}%, expected ~5%)`);
    console.log(`[BENCHMARK] Frenzy triggers: ${frenzies} (${(frenzies / clicks * 100).toFixed(3)}%, expected ~0.3-0.5% with cooldowns)`);
    console.log(`[BENCHMARK] Treat drops: ${treats} (${(treats / clicks * 100).toFixed(2)}%, expected ~2%)`);

    expect(sim.getState().clickStats.totalClicks).toBe(100000);
    expect(crits).toBeGreaterThan(4000);
    expect(crits).toBeLessThan(6000);
    expect(frenzies).toBeGreaterThan(30); // Lower than 0.5% because frenzy blocks re-triggering during its 15s duration!
    expect(treats).toBeGreaterThan(1500);
    expect(treats).toBeLessThan(2500);
  });

  it('executes 100,000 fixed ticks (5,000s game time) under all 5 unlocked zones', () => {
    const sim = new GameSimulation({ seed: 'tick-bench-100k' });

    // Unlock all zones
    for (const z of getAllZones()) {
      if (!sim.getState().territory.unlockedZones.includes(z.id)) {
        sim.getState().territory.unlockedZones.push(z.id);
      }
    }

    // Add high passive production
    sim.getState().facilities['fifi_broom'].level = 50;
    sim.getState().facilities['fifi_garden'].level = 20;

    const t0 = Date.now();
    // 100,000 ticks in batches of 200 ticks (10,000ms delta per batch)
    for (let batch = 0; batch < 500; batch++) {
      sim.tick(10000); // 10 seconds per batch = 200 ticks
    }
    const durationMs = Date.now() - t0;

    const state = sim.getState();
    console.log(`[BENCHMARK] 100k simulation steps executed in ${durationMs}ms`);
    console.log(`[BENCHMARK] Gold accumulated: ${state.currencies.gold.toFixed(0)}`);
    console.log(`[BENCHMARK] Active wild creatures: ${state.creatures.wildActive.length} (Cap is 15 across 5 zones)`);

    expect(state.creatures.wildActive.length).toBeLessThanOrEqual(15);
    expect(state.currencies.gold).toBeGreaterThan(100000);
    expect(Number.isFinite(state.currencies.gold)).toBe(true);
  });

  it('validates offline progression across all benchmark durations (1h, 24h, 7d, 1y)', () => {
    const sim = new GameSimulation({ seed: 'offline-bench' });
    sim.addResource('gold', 1e9);
    sim.buyFacility('fifi_broom', 50);
    sim.buyFacility('fifi_duster', 25);
    sim.buyFacility('fifi_garden', 10);
    sim.buyMultiplier('nyah_supervision');

    const gps = sim.getTotalGPS();
    const now = Date.now();
    const state = sim.getState();

    const durations = [
      { name: '1 Hour', seconds: 3600, expectedCappedSeconds: 3600 },
      { name: '24 Hours', seconds: 86400, expectedCappedSeconds: 86400 },
      { name: '7 Days', seconds: 604800, expectedCappedSeconds: 86400 },
      { name: '1 Year', seconds: 31536000, expectedCappedSeconds: 86400 },
    ];

    for (const d of durations) {
      state.lastTickTimestamp = now - d.seconds * 1000;
      const offline = calculateOfflineProgress(state, now, 0.80);

      console.log(`[OFFLINE] ${d.name}: elapsed = ${offline.elapsedSeconds}s, gold = ${offline.earnedGold}`);
      expect(offline.elapsedSeconds).toBe(d.expectedCappedSeconds);
      expect(offline.earnedGold).toBe(Math.floor(gps * d.expectedCappedSeconds * 0.80));
    }
  });

  it('validates full legitimate tier progression from Tier 1 through Tier 5', () => {
    const sim = new GameSimulation({ seed: 'legit-progression' });

    // Tier 1 is already unlocked
    expect(sim.getState().territory.currentTier).toBe(1);

    // Progression to Tier 2
    sim.addResource('gold', 500);
    for (let i = 0; i < 25; i++) sim.handleClick();
    expect(sim.unlockTerritory('zone_02_kitchen_garden')).toBe(true);
    expect(sim.getState().territory.currentTier).toBe(2);

    // Progression to Tier 3
    sim.addResource('gold', 7500);
    sim.addResource('treats', 30);
    expect(sim.unlockTerritory('zone_03_pond_courtyard')).toBe(true);
    expect(sim.getState().territory.currentTier).toBe(3);

    // Progression to Tier 4
    sim.addResource('gold', 85000);
    sim.addResource('essence', 200);
    expect(sim.unlockTerritory('zone_04_library_balcony')).toBe(true);
    expect(sim.getState().territory.currentTier).toBe(4);

    // Progression to Tier 5
    sim.addResource('gold', 1250000);
    sim.addResource('treats', 150);
    sim.addResource('essence', 2500);
    expect(sim.unlockTerritory('zone_05_starlight_observatory')).toBe(true);
    expect(sim.getState().territory.currentTier).toBe(5);

    expect(sim.getState().territory.unlockedZones.length).toBe(5);
  });
});
