// src/core/simulation.ts
import {
  GameState,
  IGameSimulation,
  ClickResult,
  CatchResult,
  CurrencyType,
  WildCreatureInstance,
  AudioSettings,
} from './types';
import {
  calculateSingleCost,
  calculateBulkCost,
  calculateMaxAffordable,
  calculateMilestoneMultiplier,
  calculateFacilityProduction,
  calculateClickPower,
  DeterministicRNG,
} from './math';
import { findFacility, getAllFacilities } from './facilities';
import { findMultiplier, getAllMultipliers, computeMultiplierValue } from './multipliers';
import { findZone, getAllZones, checkZoneUnlockPrerequisites } from './territory';
import {
  findSpecies,
  getAllSpecies,
  findHabitat,
  getSpeciesForZone,
  calculateCatchRoll,
  calculateCreatureProduction,
} from './creatures';
import {
  serializeState,
  deserializeState,
  calculateOfflineProgress,
} from './persistence';

export interface GameSimulationOptions {
  seed?: number | string;
  initialState?: Partial<GameState>;
}

export function createInitialState(): GameState {
  const facilitiesState: GameState['facilities'] = {};
  for (const f of getAllFacilities()) {
    facilitiesState[f.id] = {
      level: 0,
      baseProduction: f.baseProduction,
      costMultiplier: f.costRatio,
    };
  }

  const multipliersState: GameState['multipliers'] = {};
  for (const m of getAllMultipliers()) {
    multipliersState[m.id] = {
      level: 0,
      multiplierValue: 1.0,
    };
  }

  return {
    currencies: {
      gold: 0,
      treats: 0,
      essence: 0,
    },
    clickStats: {
      totalClicks: 0,
      frenzyActive: false,
      frenzyMultiplier: 1.0,
      frenzyTimeRemaining: 0,
    },
    facilities: facilitiesState,
    multipliers: multipliersState,
    territory: {
      currentTier: 1,
      unlockedZones: ['zone_01_parlor'],
    },
    creatures: {
      caught: {},
      wildActive: [],
    },
    settings: {
      masterVolume: 1.0,
      bgmVolume: 0.8,
      sfxVolume: 1.0,
      muted: false,
    },
    lastTickTimestamp: Date.now(),
    stats: {
      totalClicks: 0,
      totalGoldEarned: 0,
      totalTreatsEarned: 0,
      totalEssenceEarned: 0,
      totalCreaturesCaught: 0,
      playTimeSeconds: 0,
    },
  };
}

export class GameSimulation implements IGameSimulation {
  private state: GameState;
  private rng: DeterministicRNG;
  private tickAccumulator = 0;
  private spawnTimers: Record<string, number> = {};
  private nextWildId = 1;

  constructor(options?: GameSimulationOptions) {
    this.rng = new DeterministicRNG(options?.seed ?? 123456789);
    this.state = createInitialState();
    if (options?.initialState) {
      this.state = {
        ...this.state,
        ...options.initialState,
        currencies: { ...this.state.currencies, ...options.initialState.currencies },
        clickStats: { ...this.state.clickStats, ...options.initialState.clickStats },
        territory: { ...this.state.territory, ...options.initialState.territory },
      };
    }
    // Initialize zone spawn timers
    for (const z of getAllZones()) {
      this.spawnTimers[z.id] = 10.0 + this.rng.next() * 15.0;
    }
  }

  public getState(): Readonly<GameState> {
    return this.state;
  }

  /**
   * Resets simulation state to fresh start.
   */
  public reset(): void {
    this.state = createInitialState();
    this.tickAccumulator = 0;
    for (const z of getAllZones()) {
      this.spawnTimers[z.id] = 10.0 + this.rng.next() * 15.0;
    }
  }

  /**
   * Directly adds resources (useful for test seeding or cheat codes).
   */
  public addResource(currency: CurrencyType | string, amount: number): void {
    const amt = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    const curr = currency.toLowerCase();
    if (curr === 'gold') {
      this.state.currencies.gold += amt;
      if (this.state.stats) this.state.stats.totalGoldEarned += amt;
    } else if (curr === 'treats' || curr === 'treat') {
      this.state.currencies.treats += amt;
      if (this.state.stats) this.state.stats.totalTreatsEarned += amt;
    } else if (curr === 'essence') {
      this.state.currencies.essence += amt;
      if (this.state.stats) this.state.stats.totalEssenceEarned += amt;
    }
  }

  /**
   * Total Gold Per Second from facilities, multipliers, creatures, and territory.
   */
  public getTotalGPS(): number {
    let baseGold = 0;

    // Facilities
    for (const [id, fState] of Object.entries(this.state.facilities)) {
      if (fState.level > 0) {
        const def = findFacility(id);
        if (def && def.outputCurrency === 'gold') {
          baseGold += calculateFacilityProduction(def.baseProduction, fState.level);
        }
      }
    }

    // Fifi multiplier
    let fifiMult = 1.0;
    const sup = this.state.multipliers['nyah_supervision'];
    if (sup && sup.level > 0) {
      fifiMult = sup.multiplierValue;
    }

    let goldFromFacilities = baseGold * fifiMult;

    // Assigned creatures
    let goldFromCreatures = 0;
    for (const [specId, cData] of Object.entries(this.state.creatures.caught)) {
      if (cData.count > 0 && cData.assignedHabitat) {
        const spec = findSpecies(specId);
        if (spec) {
          const prod = calculateCreatureProduction(spec, cData.count, cData.level);
          goldFromCreatures += prod.gold;
        }
      }
    }

    // Global gold multiplier & compounding multiplier
    let globalGoldMult = 1.0;
    const insp = this.state.multipliers['nyah_inspection'];
    if (insp && insp.level > 0) {
      globalGoldMult = insp.multiplierValue;
    }

    let compoundMult = 1.0;
    const audit = this.state.multipliers['nyah_auditing'];
    if (audit && audit.level > 0) {
      compoundMult = audit.multiplierValue;
    }

    // Territory gold multipliers
    let territoryGoldMult = 1.0;
    for (const zId of this.state.territory.unlockedZones) {
      const z = findZone(zId);
      if (z?.productionBonus?.goldMultiplier) {
        territoryGoldMult *= z.productionBonus.goldMultiplier;
      }
    }

    const total = (goldFromFacilities + goldFromCreatures) * globalGoldMult * compoundMult * territoryGoldMult;
    return Math.round(total * 100) / 100;
  }

  /**
   * Total Treats Per Second.
   */
  public getTotalTPS(): number {
    let tps = 0;
    // Facilities with secondary or primary treats output
    for (const [id, fState] of Object.entries(this.state.facilities)) {
      if (fState.level > 0) {
        const def = findFacility(id);
        if (def) {
          if (def.outputCurrency === 'treats') {
            tps += calculateFacilityProduction(def.baseProduction, fState.level);
          }
          if (def.secondaryOutput && def.secondaryOutput.currency === 'treats') {
            tps += def.secondaryOutput.rate * fState.level;
          }
        }
      }
    }

    // Creatures
    for (const [specId, cData] of Object.entries(this.state.creatures.caught)) {
      if (cData.count > 0 && cData.assignedHabitat) {
        const spec = findSpecies(specId);
        if (spec) {
          const prod = calculateCreatureProduction(spec, cData.count, cData.level);
          tps += prod.treats;
        }
      }
    }

    // Compound multiplier
    const audit = this.state.multipliers['nyah_auditing'];
    if (audit && audit.level > 0) {
      tps *= audit.multiplierValue;
    }

    return Math.round(tps * 1000) / 1000;
  }

  /**
   * Total Essence Per Second.
   */
  public getTotalEPS(): number {
    let eps = 0;
    for (const [id, fState] of Object.entries(this.state.facilities)) {
      if (fState.level > 0) {
        const def = findFacility(id);
        if (def) {
          if (def.outputCurrency === 'essence') {
            eps += calculateFacilityProduction(def.baseProduction, fState.level);
          }
          if (def.secondaryOutput && def.secondaryOutput.currency === 'essence') {
            eps += def.secondaryOutput.rate * fState.level;
          }
        }
      }
    }

    for (const [specId, cData] of Object.entries(this.state.creatures.caught)) {
      if (cData.count > 0 && cData.assignedHabitat) {
        const spec = findSpecies(specId);
        if (spec) {
          const prod = calculateCreatureProduction(spec, cData.count, cData.level);
          eps += prod.essence;
        }
      }
    }

    let territoryEssenceMult = 1.0;
    for (const zId of this.state.territory.unlockedZones) {
      const z = findZone(zId);
      if (z?.productionBonus?.essenceMultiplier) {
        territoryEssenceMult *= z.productionBonus.essenceMultiplier;
      }
    }

    const audit = this.state.multipliers['nyah_auditing'];
    if (audit && audit.level > 0) {
      eps *= audit.multiplierValue;
    }

    return Math.round(eps * territoryEssenceMult * 1000) / 1000;
  }

  /**
   * Active click handler (implements Tsundere Frenzy and Crits).
   */
  public handleClick(): ClickResult {
    this.state.clickStats.totalClicks += 1;
    if (this.state.stats) this.state.stats.totalClicks += 1;

    // Crit roll
    let critRate = 0.05;
    let critMult = 2.0;

    // Creature click boosts
    let creatureClickBonus = 0;
    for (const [specId, cData] of Object.entries(this.state.creatures.caught)) {
      if (cData.count > 0 && cData.assignedHabitat) {
        const spec = findSpecies(specId);
        if (spec && spec.clickBonusPercent > 0) {
          creatureClickBonus += spec.clickBonusPercent * cData.count;
        }
      }
    }

    // Demands multiplier boosts click power
    let demandsMult = 1.0;
    const dem = this.state.multipliers['nyah_demands'];
    if (dem && dem.level > 0) {
      demandsMult = dem.multiplierValue;
    }

    // Territory click multiplier
    let territoryClickMult = 1.0;
    for (const zId of this.state.territory.unlockedZones) {
      const z = findZone(zId);
      if (z?.productionBonus?.clickMultiplier) {
        territoryClickMult *= z.productionBonus.clickMultiplier;
      }
    }

    // Crit overflow handling
    if (critRate > 0.50) {
      const overflow = critRate - 0.50;
      critRate = 0.50;
      critMult += overflow * 2.0;
    }

    const isCrit = this.rng.next() < critRate;

    // Frenzy check
    let frenzyTriggered = false;
    if (!this.state.clickStats.frenzyActive) {
      // 0.5% chance to trigger frenzy
      if (this.rng.next() < 0.005) {
        this.state.clickStats.frenzyActive = true;
        this.state.clickStats.frenzyMultiplier = 3.0;
        this.state.clickStats.frenzyTimeRemaining = 15.0;
        frenzyTriggered = true;
      }
    }

    const goldEarned = calculateClickPower({
      baseClickYield: 1.0,
      upgradesClickPower: creatureClickBonus * 10.0,
      totalGPS: this.getTotalGPS(),
      frenzyActive: this.state.clickStats.frenzyActive,
      frenzyMultiplier: this.state.clickStats.frenzyMultiplier,
      globalMultiplier: demandsMult * territoryClickMult,
      isCrit,
      critMultiplier: critMult,
    });

    this.state.currencies.gold += goldEarned;
    if (this.state.stats) this.state.stats.totalGoldEarned += goldEarned;

    // Bonus loot drops
    let treatDropped = false;
    if (this.rng.next() < 0.02) {
      this.state.currencies.treats += 1;
      if (this.state.stats) this.state.stats.totalTreatsEarned += 1;
      treatDropped = true;
    }

    let essenceDropped = false;
    if (this.state.territory.unlockedZones.length > 1 && this.rng.next() < 0.01) {
      this.state.currencies.essence += 1;
      if (this.state.stats) this.state.stats.totalEssenceEarned += 1;
      essenceDropped = true;
    }

    return {
      goldEarned,
      isCrit,
      frenzyTriggered,
      treatDropped,
      essenceDropped,
    };
  }

  /**
   * Alias for handleClick.
   */
  public clickChore(): ClickResult {
    return this.handleClick();
  }

  /**
   * Gets upgrade or facility cost for count levels.
   */
  public getUpgradeCost(facilityOrMultiplierId: string, count = 1): number {
    const fac = findFacility(facilityOrMultiplierId);
    if (fac) {
      const currentLevel = this.state.facilities[fac.id]?.level ?? 0;
      if (count === -1) {
        return calculateMaxAffordable(this.state.currencies.gold, fac.baseCost, fac.costRatio, currentLevel).cost;
      }
      return calculateBulkCost(fac.baseCost, fac.costRatio, currentLevel, count);
    }

    const mult = findMultiplier(facilityOrMultiplierId);
    if (mult) {
      const currentLevel = this.state.multipliers[mult.id]?.level ?? 0;
      if (count === -1) {
        return calculateMaxAffordable(this.state.currencies.gold, mult.baseCost, mult.costRatio, currentLevel).cost;
      }
      return calculateBulkCost(mult.baseCost, mult.costRatio, currentLevel, count);
    }

    return 0;
  }

  /**
   * Gets current owned level for a facility or multiplier.
   */
  public getUpgradeLevel(facilityOrMultiplierId: string): number {
    const fac = findFacility(facilityOrMultiplierId);
    if (fac) return this.state.facilities[fac.id]?.level ?? 0;

    const mult = findMultiplier(facilityOrMultiplierId);
    if (mult) return this.state.multipliers[mult.id]?.level ?? 0;

    return 0;
  }

  /**
   * Gets isolated production rate for a specific facility at its current level.
   */
  public getFacilityProduction(facilityId: string): number {
    const fac = findFacility(facilityId);
    if (!fac) return 0;
    const level = this.state.facilities[fac.id]?.level ?? 0;
    return calculateFacilityProduction(fac.baseProduction, level);
  }

  /**
   * Buy facility with closed-form bulk buy (count = 1, 10, 25, or -1 for Max).
   */
  public buyFacility(facilityId: string, count = 1): boolean {
    const fac = findFacility(facilityId);
    if (!fac) return false;

    if (count !== -1 && (!Number.isInteger(count) || count < 1)) return false;

    const currentLevel = this.state.facilities[fac.id]?.level ?? 0;
    let purchaseCount = count;
    let cost = 0;

    if (count === -1) {
      const maxInfo = calculateMaxAffordable(
        this.state.currencies.gold,
        fac.baseCost,
        fac.costRatio,
        currentLevel
      );
      if (maxInfo.count <= 0) return false;
      purchaseCount = maxInfo.count;
      cost = maxInfo.cost;
    } else {
      cost = calculateBulkCost(fac.baseCost, fac.costRatio, currentLevel, count);
    }

    if (!Number.isFinite(this.state.currencies.gold) || this.state.currencies.gold < cost) {
      return false;
    }

    this.state.currencies.gold -= cost;
    this.state.facilities[fac.id].level += purchaseCount;
    return true;
  }

  /**
   * Buy multiplier by ID or alias.
   */
  public buyMultiplier(multiplierId: string): boolean {
    const mult = findMultiplier(multiplierId);
    if (!mult) return false;

    const currentLevel = this.state.multipliers[mult.id]?.level ?? 0;
    const cost = calculateSingleCost(mult.baseCost, mult.costRatio, currentLevel);

    if (!Number.isFinite(this.state.currencies.gold) || this.state.currencies.gold < cost) {
      return false;
    }

    this.state.currencies.gold -= cost;
    const newLevel = currentLevel + 1;
    this.state.multipliers[mult.id].level = newLevel;
    this.state.multipliers[mult.id].multiplierValue = computeMultiplierValue(mult, newLevel);
    return true;
  }

  /**
   * Generic upgrade buy dispatcher (facility or multiplier).
   */
  public buyUpgrade(id: string, count = 1): boolean {
    if (findFacility(id)) {
      return this.buyFacility(id, count);
    }
    if (findMultiplier(id)) {
      return this.buyMultiplier(id);
    }
    return false;
  }

  /**
   * Unlocks territory zone given ID or alias.
   */
  public unlockTerritory(zoneId: string): boolean {
    const zone = findZone(zoneId);
    if (!zone) return false;

    if (!Number.isFinite(this.state.currencies.gold) || this.state.currencies.gold < zone.costGold) {
      return false;
    }
    if (!Number.isFinite(this.state.currencies.treats) || this.state.currencies.treats < zone.costTreats) {
      return false;
    }
    if (!Number.isFinite(this.state.currencies.essence) || this.state.currencies.essence < zone.costEssence) {
      return false;
    }

    const check = checkZoneUnlockPrerequisites(
      zone,
      this.state.territory.unlockedZones,
      this.state.clickStats.totalClicks,
      this.state.currencies
    );

    if (!check.canUnlock) {
      return false;
    }

    this.state.currencies.gold -= zone.costGold;
    this.state.currencies.treats -= zone.costTreats;
    this.state.currencies.essence -= zone.costEssence;

    this.state.territory.unlockedZones.push(zone.id);
    this.state.territory.currentTier = Math.max(this.state.territory.currentTier, zone.tier);
    return true;
  }

  /**
   * Spawns a wild creature in an unlocked zone.
   */
  public spawnWildCreature(zoneId?: string, speciesId?: string): WildCreatureInstance | null {
    let targetZoneId = zoneId;
    if (!targetZoneId) {
      // Pick random unlocked zone
      const zones = this.state.territory.unlockedZones;
      targetZoneId = zones[Math.floor(this.rng.next() * zones.length)];
    }

    const availableSpecies = getSpeciesForZone(targetZoneId);
    if (availableSpecies.length === 0) return null;

    let targetSpecies = speciesId ? findSpecies(speciesId) : undefined;
    if (!targetSpecies) {
      targetSpecies = availableSpecies[Math.floor(this.rng.next() * availableSpecies.length)];
    }

    const wildInstance: WildCreatureInstance = {
      id: `wild_${targetSpecies.id}_${this.nextWildId++}`,
      speciesId: targetSpecies.id,
      zoneId: targetZoneId,
      x: Math.floor(40 + this.rng.next() * 400),
      y: Math.floor(40 + this.rng.next() * 200),
      timer: 45.0, // 45 seconds lifetime
    };

    this.state.creatures.wildActive.push(wildInstance);
    return wildInstance;
  }

  /**
   * Attempts to catch an active wild creature.
   */
  public attemptCatchCreature(wildInstanceId: string, useBait: boolean): CatchResult {
    const idx = this.state.creatures.wildActive.findIndex((w) => w.id === wildInstanceId);
    if (idx === -1) {
      return { success: false, speciesId: '', fled: false };
    }

    const wild = this.state.creatures.wildActive[idx];
    const species = findSpecies(wild.speciesId);
    if (!species) {
      return { success: false, speciesId: wild.speciesId, fled: true };
    }

    let actualBaitUsed = false;
    if (useBait) {
      if (this.state.currencies.treats >= 1) {
        this.state.currencies.treats -= 1;
        actualBaitUsed = true;
      }
    }

    const rollResult = calculateCatchRoll(species, actualBaitUsed, this.rng);

    if (rollResult.success) {
      // Remove wild creature
      this.state.creatures.wildActive.splice(idx, 1);

      // Add to caught roster
      if (!this.state.creatures.caught[species.id]) {
        this.state.creatures.caught[species.id] = {
          count: 1,
          level: 1,
          assignedHabitat: species.preferredHabitatId,
          xp: 0,
          isShiny: rollResult.isShiny,
        };
      } else {
        this.state.creatures.caught[species.id].count += 1;
        if (rollResult.isShiny) {
          this.state.creatures.caught[species.id].isShiny = true;
        }
      }

      if (this.state.stats) {
        this.state.stats.totalCreaturesCaught += 1;
      }

      return {
        success: true,
        speciesId: species.id,
        isShiny: rollResult.isShiny,
      };
    } else {
      if (rollResult.fled) {
        this.state.creatures.wildActive.splice(idx, 1);
      }
      return {
        success: false,
        speciesId: species.id,
        fled: rollResult.fled,
      };
    }
  }

  /**
   * Alias for attemptCatchCreature.
   */
  public catchCreature(wildInstanceId: string, useBait = false): CatchResult {
    return this.attemptCatchCreature(wildInstanceId, useBait);
  }

  /**
   * Assigns a caught creature to a habitat.
   */
  public assignCreature(speciesId: string, habitatId: string): boolean {
    const spec = findSpecies(speciesId);
    if (!spec) return false;

    const caught = this.state.creatures.caught[spec.id];
    if (!caught || caught.count <= 0) return false;

    // Unassign creature if habitatId is falsy, empty, or 'none'
    if (!habitatId || habitatId === '' || habitatId === 'none') {
      caught.assignedHabitat = undefined;
      return true;
    }

    const hab = findHabitat(habitatId);
    if (!hab) return false;

    // Verify habitat zone is unlocked
    if (!this.state.territory.unlockedZones.includes(hab.zoneId)) {
      return false;
    }

    // Check habitat capacity
    let currentlyAssigned = 0;
    for (const c of Object.values(this.state.creatures.caught)) {
      if (c.assignedHabitat === hab.id) {
        currentlyAssigned += c.count;
      }
    }

    if (currentlyAssigned + caught.count > hab.capacity && caught.assignedHabitat !== hab.id) {
      return false;
    }

    caught.assignedHabitat = hab.id;
    return true;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) return;
    this.tickAccumulator += deltaMs;

    const FIXED_STEP_MS = 50; // 20 ticks per second (50ms)
    const dtSeconds = FIXED_STEP_MS / 1000;
    const maxTicksPerCall = 50000; // safeguard against runaway loops
    let ticksExecuted = 0;

    while (this.tickAccumulator >= FIXED_STEP_MS && ticksExecuted < maxTicksPerCall) {
      this.stepSimulation(dtSeconds);
      this.tickAccumulator -= FIXED_STEP_MS;
      ticksExecuted++;
    }

    if (ticksExecuted >= maxTicksPerCall) {
      this.tickAccumulator = 0;
    }

    this.state.lastTickTimestamp = Date.now();
  }

  /**
   * Executes a single deterministic simulation step of dtSeconds.
   */
  private stepSimulation(dt: number): void {
    // 1. Passive currency accumulation
    const gps = this.getTotalGPS();
    const tps = this.getTotalTPS();
    const eps = this.getTotalEPS();

    const goldEarned = gps * dt;
    const treatsEarned = tps * dt;
    const essenceEarned = eps * dt;

    this.state.currencies.gold += goldEarned;
    this.state.currencies.treats += treatsEarned;
    this.state.currencies.essence += essenceEarned;

    if (this.state.stats) {
      this.state.stats.totalGoldEarned += goldEarned;
      this.state.stats.totalTreatsEarned += treatsEarned;
      this.state.stats.totalEssenceEarned += essenceEarned;
      this.state.stats.playTimeSeconds += dt;
    }

    // 2. Frenzy timer update
    if (this.state.clickStats.frenzyActive) {
      this.state.clickStats.frenzyTimeRemaining -= dt;
      if (this.state.clickStats.frenzyTimeRemaining <= 0) {
        this.state.clickStats.frenzyActive = false;
        this.state.clickStats.frenzyMultiplier = 1.0;
        this.state.clickStats.frenzyTimeRemaining = 0;
      }
    }

    // 3. Wild creature timers & despawning
    for (let i = this.state.creatures.wildActive.length - 1; i >= 0; i--) {
      const wild = this.state.creatures.wildActive[i];
      wild.timer -= dt;
      if (wild.timer <= 0) {
        this.state.creatures.wildActive.splice(i, 1);
      }
    }

    // 4. Wild creature spawning timers per unlocked zone
    for (const zoneId of this.state.territory.unlockedZones) {
      if (this.spawnTimers[zoneId] === undefined) {
        this.spawnTimers[zoneId] = 15.0 + this.rng.next() * 20.0;
      }

      this.spawnTimers[zoneId] -= dt;
      if (this.spawnTimers[zoneId] <= 0) {
        // Count active wild in this zone
        const inZone = this.state.creatures.wildActive.filter((w) => w.zoneId === zoneId).length;
        if (inZone < 3) {
          this.spawnWildCreature(zoneId);
        }
        this.spawnTimers[zoneId] = 15.0 + this.rng.next() * 20.0;
      }
    }
  }

  /**
   * Returns serialized save string.
   */
  public getSaveData(): string {
    return serializeState(this.state);
  }

  /**
   * Loads save string and calculates offline progress catch-up.
   */
  public loadSaveData(json: string): boolean {
    const loaded = deserializeState(json, createInitialState);
    if (!loaded) return false;

    // Apply offline progress
    const offline = calculateOfflineProgress(loaded, Date.now(), 0.80);
    loaded.currencies.gold += offline.earnedGold;
    loaded.currencies.treats += offline.earnedTreats;
    loaded.currencies.essence += offline.earnedEssence;

    if (loaded.stats) {
      loaded.stats.totalGoldEarned += offline.earnedGold;
      loaded.stats.totalTreatsEarned += offline.earnedTreats;
      loaded.stats.totalEssenceEarned += offline.earnedEssence;
    }

    this.state = loaded;
    return true;
  }

  /**
   * Updates audio settings state.
   */
  public updateAudioSettings(settings: Partial<AudioSettings>): void {
    this.state.settings = {
      ...this.state.settings,
      ...settings,
    };
  }
}
