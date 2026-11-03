import type {
  GameState,
  IGameSimulation,
  ClickResult,
  CatchResult,
  SaveData,
} from '../../src/core/types';

/**
 * Creates a fresh GameSimulation instance.
 */
export async function createSimulation(): Promise<IGameSimulation> {
  const mod = await import('../../src/core/simulation');
  return new mod.GameSimulation();
}

/**
 * Deterministically advances simulation by totalSeconds in discrete tick steps (default: 50ms).
 */
export function advanceTime(sim: IGameSimulation, totalSeconds: number, stepMs = 50): void {
  const totalTicks = Math.max(1, Math.round((totalSeconds * 1000) / stepMs));
  for (let i = 0; i < totalTicks; i++) {
    sim.tick(stepMs);
  }
}

/**
 * Validates that GameState has zero NaN, finite numbers, and non-negative currency balances.
 */
export function assertStateIntegrity(state: Readonly<GameState>): void {
  if (state.currencies.gold < 0 || Number.isNaN(state.currencies.gold) || !Number.isFinite(state.currencies.gold)) {
    throw new Error(`Invalid gold currency value: ${state.currencies.gold}`);
  }
  if (state.currencies.treats < 0 || Number.isNaN(state.currencies.treats) || !Number.isFinite(state.currencies.treats)) {
    throw new Error(`Invalid treats currency value: ${state.currencies.treats}`);
  }
  if (state.currencies.essence < 0 || Number.isNaN(state.currencies.essence) || !Number.isFinite(state.currencies.essence)) {
    throw new Error(`Invalid essence currency value: ${state.currencies.essence}`);
  }
  if (state.clickStats.totalClicks < 0 || Number.isNaN(state.clickStats.totalClicks)) {
    throw new Error(`Invalid total clicks: ${state.clickStats.totalClicks}`);
  }
  if (!Array.isArray(state.territory.unlockedZones) || state.territory.unlockedZones.length === 0) {
    throw new Error(`Unlocked zones must contain at least the starting zone`);
  }
}

/**
 * Opaque-box helper: modifies state via standard JSON save/load roundtrip.
 */
export function seedSimulationState(
  sim: IGameSimulation,
  mutator: (data: SaveData) => void
): boolean {
  const rawSave = sim.getSaveData();
  const parsed = JSON.parse(rawSave) as SaveData;
  mutator(parsed);
  return sim.loadSaveData(JSON.stringify(parsed));
}
