// src/core/persistence.ts
import { GameState, SaveData } from './types';
import { calculateFacilityProduction } from './math';
import { findFacility } from './facilities';
import { findMultiplier, computeMultiplierValue } from './multipliers';
import { findSpecies, calculateCreatureProduction } from './creatures';
import { findZone } from './territory';

export const CURRENT_SCHEMA_VERSION = 1;
export const DEFAULT_SAVE_KEY = 'idlenyah_save_v1';

// In-memory fallback for environments without window.localStorage (e.g. Node tests)
let inMemoryStore: Record<string, string> = {};

function getStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (k: string) => inMemoryStore[k] ?? null,
    setItem: (k: string, v: string) => { inMemoryStore[k] = v; },
    removeItem: (k: string) => { delete inMemoryStore[k]; },
  };
}

export function clearInMemoryStorage(): void {
  inMemoryStore = {};
}

/**
 * Serializes GameState into a versioned SaveData structure JSON string.
 */
export function serializeState(state: GameState): string {
  const saveData: SaveData = {
    version: CURRENT_SCHEMA_VERSION,
    timestamp: Date.now(),
    currencies: {
      gold: state.currencies.gold,
      treats: state.currencies.treats,
      essence: state.currencies.essence,
    },
    clickStats: {
      totalClicks: state.clickStats.totalClicks,
      frenzyActive: false, // frenzy does not persist across reloads
      frenzyMultiplier: 1.0,
      frenzyTimeRemaining: 0,
    },
    facilities: Object.fromEntries(
      Object.entries(state.facilities).map(([k, v]) => [k, { level: v.level }])
    ),
    multipliers: Object.fromEntries(
      Object.entries(state.multipliers).map(([k, v]) => [k, { level: v.level }])
    ),
    territory: {
      currentTier: state.territory.currentTier,
      unlockedZones: [...state.territory.unlockedZones],
    },
    creatures: {
      caught: { ...state.creatures.caught },
    },
    settings: {
      masterVolume: state.settings.masterVolume,
      bgmVolume: state.settings.bgmVolume,
      sfxVolume: state.settings.sfxVolume,
      muted: state.settings.muted,
    },
    stats: state.stats
      ? { ...state.stats }
      : {
          totalClicks: state.clickStats.totalClicks,
          totalGoldEarned: state.currencies.gold,
          totalTreatsEarned: state.currencies.treats,
          totalEssenceEarned: state.currencies.essence,
          totalCreaturesCaught: Object.values(state.creatures.caught).reduce((acc, c) => acc + c.count, 0),
          playTimeSeconds: 0,
        },
  };

  return JSON.stringify(saveData, null, 2);
}

/**
 * Deserializes and validates a JSON save string, applying version migrations if needed.
 */
export function deserializeState(json: string, defaultFactory: () => GameState): GameState | null {
  try {
    const raw = JSON.parse(json);
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const state = defaultFactory();

    // Version migration pipeline
    const version = typeof raw.version === 'number' ? raw.version : 0;
    if (version < 1) {
      // Migrate v0 -> v1: ensure currencies object exists
      if (!raw.currencies && raw.resources) {
        raw.currencies = {
          gold: raw.resources.gold ?? 0,
          treats: raw.resources.treats ?? 0,
          essence: raw.resources.essence ?? 0,
        };
      }
    }

    // Currencies
    if (raw.currencies && typeof raw.currencies === 'object') {
      state.currencies.gold = Math.max(0, Number(raw.currencies.gold) || 0);
      state.currencies.treats = Math.max(0, Number(raw.currencies.treats) || 0);
      state.currencies.essence = Math.max(0, Number(raw.currencies.essence) || 0);
    }

    // Click stats
    if (raw.clickStats && typeof raw.clickStats === 'object') {
      state.clickStats.totalClicks = Math.max(0, Number(raw.clickStats.totalClicks) || 0);
    }

    // Facilities
    if (raw.facilities && typeof raw.facilities === 'object') {
      for (const [id, data] of Object.entries(raw.facilities)) {
        const level = typeof data === 'object' && data !== null && 'level' in data ? Number(data.level) || 0 : Number(data) || 0;
        const fac = findFacility(id);
        if (fac) {
          state.facilities[fac.id] = {
            level: Math.max(0, level),
            baseProduction: fac.baseProduction,
            costMultiplier: fac.costRatio,
          };
        }
      }
    }

    // Multipliers
    if (raw.multipliers && typeof raw.multipliers === 'object') {
      for (const [id, data] of Object.entries(raw.multipliers)) {
        const level = typeof data === 'object' && data !== null && 'level' in data ? Number(data.level) || 0 : Number(data) || 0;
        const mult = findMultiplier(id);
        if (mult) {
          state.multipliers[mult.id] = {
            level: Math.max(0, level),
            multiplierValue: computeMultiplierValue(mult, level),
          };
        }
      }
    }

    // Territory
    if (raw.territory && typeof raw.territory === 'object') {
      if (Array.isArray(raw.territory.unlockedZones)) {
        state.territory.unlockedZones = raw.territory.unlockedZones.filter(
          (z: any) => typeof z === 'string' && findZone(z) !== undefined
        );
        if (!state.territory.unlockedZones.includes('zone_01_parlor')) {
          state.territory.unlockedZones.unshift('zone_01_parlor');
        }
      }
      state.territory.currentTier = Math.max(1, Number(raw.territory.currentTier) || 1);
    }

    // Caught creatures
    if (raw.creatures && typeof raw.creatures.caught === 'object') {
      state.creatures.caught = {};
      for (const [specId, cData] of Object.entries(raw.creatures.caught)) {
        const spec = findSpecies(specId);
        if (spec && typeof cData === 'object' && cData !== null) {
          const d = cData as any;
          state.creatures.caught[spec.id] = {
            count: Math.max(0, Number(d.count) || 0),
            level: Math.max(1, Number(d.level) || 1),
            assignedHabitat: typeof d.assignedHabitat === 'string' ? d.assignedHabitat : undefined,
            xp: Math.max(0, Number(d.xp) || 0),
            isShiny: Boolean(d.isShiny),
          };
        }
      }
    }

    // Settings
    if (raw.settings && typeof raw.settings === 'object') {
      state.settings.masterVolume = Math.min(1, Math.max(0, Number(raw.settings.masterVolume) ?? 1.0));
      state.settings.bgmVolume = Math.min(1, Math.max(0, Number(raw.settings.bgmVolume) ?? 0.8));
      state.settings.sfxVolume = Math.min(1, Math.max(0, Number(raw.settings.sfxVolume) ?? 1.0));
      state.settings.muted = Boolean(raw.settings.muted);
    }

    // Stats
    if (raw.stats && typeof raw.stats === 'object') {
      state.stats = {
        totalClicks: Math.max(0, Number(raw.stats.totalClicks) || 0),
        totalGoldEarned: Math.max(0, Number(raw.stats.totalGoldEarned) || 0),
        totalTreatsEarned: Math.max(0, Number(raw.stats.totalTreatsEarned) || 0),
        totalEssenceEarned: Math.max(0, Number(raw.stats.totalEssenceEarned) || 0),
        totalCreaturesCaught: Math.max(0, Number(raw.stats.totalCreaturesCaught) || 0),
        playTimeSeconds: Math.max(0, Number(raw.stats.playTimeSeconds) || 0),
      };
    }

    state.lastTickTimestamp = typeof raw.timestamp === 'number' ? raw.timestamp : Date.now();
    return state;
  } catch (err) {
    console.warn('Failed to parse save data JSON:', err);
    return null;
  }
}

/**
 * Exports save string. Can be base64 or raw JSON.
 */
export function exportSaveString(state: GameState): string {
  const json = serializeState(state);
  if (typeof btoa !== 'undefined') {
    try {
      return btoa(unescape(encodeURIComponent(json)));
    } catch {
      return json;
    }
  }
  return json;
}

/**
 * Imports save string, handling raw JSON or base64 encoded strings.
 */
export function importSaveString(encodedOrJson: string, defaultFactory: () => GameState): GameState | null {
  const trimmed = encodedOrJson.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return deserializeState(trimmed, defaultFactory);
  }
  // Try base64 decoding
  try {
    let decoded: string;
    if (typeof atob !== 'undefined') {
      decoded = decodeURIComponent(escape(atob(trimmed)));
    } else {
      decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    }
    return deserializeState(decoded, defaultFactory);
  } catch {
    // If base64 fails, fallback to direct JSON attempt
    return deserializeState(trimmed, defaultFactory);
  }
}

/**
 * Saves current state to LocalStorage.
 */
export function saveToLocalStorage(state: GameState, key = DEFAULT_SAVE_KEY): boolean {
  try {
    const json = serializeState(state);
    getStorage().setItem(key, json);
    return true;
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
    return false;
  }
}

/**
 * Loads current state from LocalStorage.
 */
export function loadFromLocalStorage(defaultFactory: () => GameState, key = DEFAULT_SAVE_KEY): GameState | null {
  try {
    const json = getStorage().getItem(key);
    if (!json) return null;
    return deserializeState(json, defaultFactory);
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return null;
  }
}

/**
 * Computes offline progress since last save.
 * Capped at 86,400 seconds (24 hours).
 * Default efficiency 80% (0.80).
 */
export function calculateOfflineProgress(
  state: GameState,
  currentTimestamp: number,
  efficiency = 0.80
): {
  elapsedSeconds: number;
  earnedGold: number;
  earnedTreats: number;
  earnedEssence: number;
} {
  const now = Number.isFinite(currentTimestamp) ? currentTimestamp : Date.now();
  const lastTime = Number.isFinite(state.lastTickTimestamp) && state.lastTickTimestamp > 0 ? state.lastTickTimestamp : now;
  const elapsedMs = Math.max(0, now - lastTime);
  const elapsedSeconds = Math.min(86400, Math.floor(elapsedMs / 1000));

  if (elapsedSeconds <= 0) {
    return { elapsedSeconds: 0, earnedGold: 0, earnedTreats: 0, earnedEssence: 0 };
  }

  // Calculate passive production rates
  let baseGoldPerSec = 0;
  let baseTreatsPerSec = 0;
  let baseEssencePerSec = 0;

  // 1. Facilities
  for (const [facId, facState] of Object.entries(state.facilities)) {
    if (facState.level > 0) {
      const def = findFacility(facId);
      if (def) {
        const prod = calculateFacilityProduction(def.baseProduction, facState.level);
        if (def.outputCurrency === 'gold') baseGoldPerSec += prod;
        if (def.outputCurrency === 'treats') baseTreatsPerSec += prod;
        if (def.outputCurrency === 'essence') baseEssencePerSec += prod;

        if (def.secondaryOutput) {
          const secRate = def.secondaryOutput.rate * facState.level;
          if (def.secondaryOutput.currency === 'treats') baseTreatsPerSec += secRate;
          if (def.secondaryOutput.currency === 'essence') baseEssencePerSec += secRate;
        }
      }
    }
  }

  // 2. Multipliers
  let fifiMultiplier = 1.0;
  let globalGoldMultiplier = 1.0;
  let compoundMultiplier = 1.0;

  for (const [multId, multState] of Object.entries(state.multipliers)) {
    if (multState.level > 0) {
      const def = findMultiplier(multId);
      if (def) {
        const val = multState.multiplierValue || computeMultiplierValue(def, multState.level);
        if (def.category === 'fifi_boost') fifiMultiplier *= val;
        if (def.category === 'global_gold') globalGoldMultiplier *= val;
        if (def.category === 'compound') compoundMultiplier *= val;
      }
    }
  }

  // 3. Creatures
  for (const [specId, cData] of Object.entries(state.creatures.caught)) {
    if (cData.count > 0 && cData.assignedHabitat) {
      const spec = findSpecies(specId);
      if (spec) {
        const prod = calculateCreatureProduction(spec, cData.count, cData.level);
        baseGoldPerSec += prod.gold;
        baseTreatsPerSec += prod.treats;
        baseEssencePerSec += prod.essence;
      }
    }
  }

  // 4. Territory bonuses
  let territoryGoldBonus = 1.0;
  let territoryEssenceBonus = 1.0;
  for (const zId of state.territory.unlockedZones) {
    const z = findZone(zId);
    if (z?.productionBonus) {
      if (z.productionBonus.goldMultiplier) territoryGoldBonus *= z.productionBonus.goldMultiplier;
      if (z.productionBonus.essenceMultiplier) territoryEssenceBonus *= z.productionBonus.essenceMultiplier;
    }
  }

  const effectiveGoldPerSec =
    baseGoldPerSec * fifiMultiplier * globalGoldMultiplier * compoundMultiplier * territoryGoldBonus;
  const effectiveTreatsPerSec = baseTreatsPerSec * compoundMultiplier;
  const effectiveEssencePerSec = baseEssencePerSec * compoundMultiplier * territoryEssenceBonus;

  const earnedGold = Math.floor(effectiveGoldPerSec * elapsedSeconds * efficiency);
  const earnedTreats = Math.floor(effectiveTreatsPerSec * elapsedSeconds * efficiency * 10) / 10;
  const earnedEssence = Math.floor(effectiveEssencePerSec * elapsedSeconds * efficiency * 10) / 10;

  return {
    elapsedSeconds,
    earnedGold: Math.max(0, earnedGold),
    earnedTreats: Math.max(0, earnedTreats),
    earnedEssence: Math.max(0, earnedEssence),
  };
}
