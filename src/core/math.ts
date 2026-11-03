// src/core/math.ts

export const MILESTONES: Array<{ level: number; multiplier: number }> = [
  { level: 10, multiplier: 2.0 },
  { level: 25, multiplier: 2.0 },
  { level: 50, multiplier: 3.0 },
  { level: 100, multiplier: 4.0 },
  { level: 150, multiplier: 2.0 },
  { level: 200, multiplier: 5.0 },
  { level: 250, multiplier: 2.0 },
];

/**
 * Calculates single-level cost at current owned level n.
 * Cost(n) = floor(baseCost * r^n)
 */
export function calculateSingleCost(baseCost: number, costRatio: number, currentLevel: number): number {
  if (currentLevel < 0) return 0;
  return Math.floor(baseCost * Math.pow(costRatio, currentLevel));
}

/**
 * Calculates exact bulk purchase cost for k levels from current level n.
 * Uses closed-form geometric series:
 * Cost(n, k) = floor(baseCost * r^n * (r^k - 1) / (r - 1))
 */
export function calculateBulkCost(
  baseCost: number,
  costRatio: number,
  currentLevel: number,
  count: number
): number {
  if (count <= 0) return 0;
  if (count === 1) {
    return calculateSingleCost(baseCost, costRatio, currentLevel);
  }
  if (Math.abs(costRatio - 1.0) < 1e-9) {
    return Math.floor(baseCost * count);
  }

  const startCost = baseCost * Math.pow(costRatio, currentLevel);
  const total = startCost * (Math.pow(costRatio, count) - 1.0) / (costRatio - 1.0);
  return Math.max(1, Math.floor(total));
}

/**
 * Calculates the maximum affordable levels given balance B, base cost, ratio, and current level.
 * k_max = floor( ln( (B * (r - 1)) / (baseCost * r^n) + 1 ) / ln(r) )
 */
export function calculateMaxAffordable(
  balance: number,
  baseCost: number,
  costRatio: number,
  currentLevel: number
): { count: number; cost: number } {
  if (!Number.isFinite(balance) || balance <= 0) return { count: 0, cost: 0 };
  const firstItemCost = calculateSingleCost(baseCost, costRatio, currentLevel);
  if (balance < firstItemCost) return { count: 0, cost: 0 };

  if (Math.abs(costRatio - 1.0) < 1e-9) {
    const count = Math.floor(balance / baseCost);
    return { count, cost: Math.floor(count * baseCost) };
  }

  const startCost = baseCost * Math.pow(costRatio, currentLevel);
  const numerator = (balance * (costRatio - 1.0)) / startCost + 1.0;
  if (numerator <= 1.0) return { count: 0, cost: 0 };

  let k = Math.floor(Math.log(numerator) / Math.log(costRatio));
  if (k <= 0) return { count: 0, cost: 0 };

  // Guard against floating point imprecision
  let cost = calculateBulkCost(baseCost, costRatio, currentLevel, k);
  while (cost > balance && k > 0) {
    k -= 1;
    cost = calculateBulkCost(baseCost, costRatio, currentLevel, k);
  }

  // Check if k + 1 is also affordable due to downward floor
  let nextCost = calculateBulkCost(baseCost, costRatio, currentLevel, k + 1);
  while (Number.isFinite(nextCost) && nextCost <= balance && nextCost > 0) {
    k += 1;
    cost = nextCost;
    nextCost = calculateBulkCost(baseCost, costRatio, currentLevel, k + 1);
  }

  return { count: k, cost };
}

/**
 * Computes the cumulative milestone multiplier for a facility/multiplier at a given level.
 * Level 10: 2x, Level 25: 4x, Level 50: 12x, Level 100: 48x, Level 150: 96x, Level 200: 480x, Level 250: 960x.
 */
export function calculateMilestoneMultiplier(level: number): number {
  if (level < 10) return 1.0;
  let mult = 1.0;
  for (const m of MILESTONES) {
    if (level >= m.level) {
      mult *= m.multiplier;
    } else {
      break;
    }
  }
  return mult;
}

/**
 * Computes facility production rate given base output, level, and milestone multipliers.
 */
export function calculateFacilityProduction(baseOutput: number, level: number): number {
  if (level <= 0) return 0;
  const milestone = calculateMilestoneMultiplier(level);
  return level * baseOutput * milestone;
}

/**
 * Calculates click power according to:
 * P_click = (1 + upgradesPower + 0.02 * totalGPS) * frenzyMult * globalMult * critMult
 */
export function calculateClickPower(params: {
  baseClickYield?: number;
  upgradesClickPower?: number;
  totalGPS?: number;
  frenzyActive?: boolean;
  frenzyMultiplier?: number;
  globalMultiplier?: number;
  isCrit?: boolean;
  critMultiplier?: number;
}): number {
  const base = params.baseClickYield ?? 1.0;
  const upgradeBonus = params.upgradesClickPower ?? 0;
  const passiveBonus = 0.02 * (params.totalGPS ?? 0);
  const frenzy = (params.frenzyActive && params.frenzyMultiplier) ? params.frenzyMultiplier : 1.0;
  const global = params.globalMultiplier ?? 1.0;
  const crit = (params.isCrit && params.critMultiplier) ? params.critMultiplier : 1.0;

  const total = (base + upgradeBonus + passiveBonus) * frenzy * global * crit;
  return Math.max(1, Math.round(total * 100) / 100);
}

/**
 * Simple deterministic linear congruential PRNG or seeded RNG generator.
 */
export class DeterministicRNG {
  private state: number;

  constructor(seed: number | string = 123456789) {
    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
      }
      this.state = Math.abs(hash) || 123456789;
    } else {
      this.state = Math.abs(seed) || 123456789;
    }
  }

  public next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }
}
