// src/core/types.ts

export type CurrencyType = 'gold' | 'treats' | 'essence';

export interface CurrenciesState {
  gold: number;
  treats: number;
  essence: number;
}

export interface ClickStats {
  totalClicks: number;
  frenzyActive: boolean;
  frenzyMultiplier: number;
  frenzyTimeRemaining: number;
}

export interface FacilityState {
  level: number;
  baseProduction: number;
  costMultiplier: number;
}

export interface MultiplierState {
  level: number;
  multiplierValue: number;
}

export interface TerritoryState {
  currentTier: number;
  unlockedZones: string[];
}

export interface CaughtCreatureData {
  count: number;
  level: number;
  assignedHabitat?: string;
  xp?: number;
  isShiny?: boolean;
}

export interface WildCreatureInstance {
  id: string;
  speciesId: string;
  zoneId: string;
  x: number;
  y: number;
  timer: number;
}

export interface CreaturesState {
  caught: Record<string, CaughtCreatureData>;
  wildActive: WildCreatureInstance[];
}

export interface AudioSettings {
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export interface GameStats {
  totalClicks: number;
  totalGoldEarned: number;
  totalTreatsEarned: number;
  totalEssenceEarned: number;
  totalCreaturesCaught: number;
  playTimeSeconds: number;
}

export interface GameState {
  currencies: CurrenciesState;
  clickStats: ClickStats;
  facilities: Record<string, FacilityState>;
  multipliers: Record<string, MultiplierState>;
  territory: TerritoryState;
  creatures: CreaturesState;
  settings: AudioSettings;
  lastTickTimestamp: number;
  stats?: GameStats;
}

export interface FacilityDefinition {
  id: string;
  name: string;
  baseCost: number;
  costRatio: number;
  baseProduction: number;
  outputCurrency: CurrencyType;
  secondaryOutput?: { currency: CurrencyType; rate: number };
  description: string;
  requiredZoneId?: string;
  aliases?: string[];
}

export interface MultiplierDefinition {
  id: string;
  name: string;
  baseCost: number;
  costRatio: number;
  multiplierPerLevel: number;
  description: string;
  category: 'fifi_boost' | 'global_gold' | 'click_power' | 'compound';
  aliases?: string[];
}

export interface TerritoryZoneDefinition {
  id: string;
  name: string;
  tier: number;
  costGold: number;
  costTreats: number;
  costEssence: number;
  prerequisiteZoneId?: string;
  prerequisiteChores?: number;
  description: string;
  habitatId: string;
  habitatName: string;
  habitatCapacity: number;
  productionBonus: {
    goldMultiplier?: number;
    essenceMultiplier?: number;
    clickMultiplier?: number;
  };
  aliases?: string[];
}

export interface CreatureSpeciesDefinition {
  id: string;
  name: string;
  tier: 'common' | 'uncommon' | 'rare' | 'mythic';
  spawnZoneId: string;
  baseCatchRate: number;
  goldPerSec: number;
  treatsPerSec: number;
  essencePerSec: number;
  clickBonusPercent: number;
  preferredHabitatId: string;
  description: string;
  aliases?: string[];
}

export interface HabitatDefinition {
  id: string;
  name: string;
  zoneId: string;
  capacity: number;
}

export interface SaveData {
  version: number;
  timestamp: number;
  currencies: CurrenciesState;
  clickStats: ClickStats;
  facilities: Record<string, { level: number }>;
  multipliers: Record<string, { level: number }>;
  territory: { currentTier: number; unlockedZones: string[] };
  creatures: {
    caught: Record<string, CaughtCreatureData>;
  };
  settings: AudioSettings;
  stats: GameStats;
}

export interface ClickResult {
  goldEarned: number;
  isCrit: boolean;
  frenzyTriggered: boolean;
  treatDropped?: boolean;
  essenceDropped?: boolean;
}

export interface CatchResult {
  success: boolean;
  speciesId: string;
  fled?: boolean;
  isShiny?: boolean;
}

export interface IGameSimulation {
  tick(deltaMs: number): void;
  handleClick(): ClickResult;
  buyFacility(facilityId: string, count: number): boolean;
  buyMultiplier(multiplierId: string): boolean;
  unlockTerritory(zoneId: string): boolean;
  attemptCatchCreature(wildInstanceId: string, useBait: boolean): CatchResult;
  assignCreature(speciesId: string, habitatId: string): boolean;
  getSaveData(): string;
  loadSaveData(json: string): boolean;
  getState(): Readonly<GameState>;
}
