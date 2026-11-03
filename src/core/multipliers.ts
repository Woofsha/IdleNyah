// src/core/multipliers.ts
import { MultiplierDefinition } from './types';
import { calculateMilestoneMultiplier } from './math';

export const NYAH_MULTIPLIERS: MultiplierDefinition[] = [
  {
    id: 'nyah_supervision',
    name: 'Nyah’s Stern Supervision',
    baseCost: 500,
    costRatio: 1.25,
    multiplierPerLevel: 0.10,
    description: 'Nyah sternly supervises Fifi, boosting all chore outputs by 10% per level.',
    category: 'fifi_boost',
    aliases: ['supervision', 'nyah_supervision', 'stern_inspection', 'nyah_inspection'],
  },
  {
    id: 'nyah_inspection',
    name: 'Royal Inspection',
    baseCost: 5000,
    costRatio: 1.30,
    multiplierPerLevel: 0.05,
    description: 'Nyah conducts royal inspections of the estate, granting a 5% compounding gold bonus per level.',
    category: 'global_gold',
    aliases: ['royal_inspection', 'inspection', 'tea_lounge', 'nyah_tea_lounge'],
  },
  {
    id: 'nyah_demands',
    name: 'Aristocratic Demands',
    baseCost: 50000,
    costRatio: 1.35,
    multiplierPerLevel: 0.15,
    description: 'Nyah demands absolute perfection, boosting click power and frenzy effects by 15% per level.',
    category: 'click_power',
    aliases: ['aristocratic_demands', 'demands', 'strict_budgeting', 'nyah_budgeting'],
  },
  {
    id: 'nyah_auditing',
    name: 'Fiscal Auditing',
    baseCost: 500000,
    costRatio: 1.40,
    multiplierPerLevel: 0.20,
    description: 'Nyah audits all estate ledgers, multiplying overall estate productivity by 20% per level.',
    category: 'compound',
    aliases: ['fiscal_auditing', 'auditing', 'royal_catnap', 'nyah_catnap'],
  },
];

const multiplierMap = new Map<string, MultiplierDefinition>();
for (const mult of NYAH_MULTIPLIERS) {
  multiplierMap.set(mult.id.toLowerCase(), mult);
  if (mult.aliases) {
    for (const alias of mult.aliases) {
      multiplierMap.set(alias.toLowerCase(), mult);
    }
  }
}

export function findMultiplier(idOrAlias: string): MultiplierDefinition | undefined {
  return multiplierMap.get(idOrAlias.toLowerCase());
}

export function getAllMultipliers(): MultiplierDefinition[] {
  return [...NYAH_MULTIPLIERS];
}

/**
 * Computes effective multiplier value for a given multiplier definition at a specified level.
 * Incorporates milestone jumps at levels 10, 25, 50, 100, etc.
 */
export function computeMultiplierValue(mult: MultiplierDefinition, level: number): number {
  if (level <= 0) return 1.0;
  const milestone = calculateMilestoneMultiplier(level);

  switch (mult.category) {
    case 'fifi_boost':
      // Additive chore boost multiplied by milestone
      return 1.0 + level * mult.multiplierPerLevel * milestone;
    case 'global_gold':
      // Compounding 5% with milestone boost
      return milestone * Math.pow(1.0 + mult.multiplierPerLevel, level);
    case 'click_power':
      return 1.0 + level * mult.multiplierPerLevel * milestone;
    case 'compound':
      return milestone * Math.pow(1.0 + mult.multiplierPerLevel, level);
    default:
      return 1.0 + level * mult.multiplierPerLevel * milestone;
  }
}
