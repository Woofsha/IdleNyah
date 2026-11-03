// src/core/facilities.ts
import { FacilityDefinition } from './types';

export const FIFI_FACILITIES: FacilityDefinition[] = [
  {
    id: 'fifi_broom',
    name: 'Simple Straw Broom',
    baseCost: 15,
    costRatio: 1.15,
    baseProduction: 1.0,
    outputCurrency: 'gold',
    description: 'Fifi sweeps the hallway floors diligently.',
    aliases: ['broom', 'fifi_broom', 'straw_broom'],
  },
  {
    id: 'fifi_duster',
    name: 'Ostrich Feather Duster',
    baseCost: 100,
    costRatio: 1.15,
    baseProduction: 5.0,
    outputCurrency: 'gold',
    description: 'Fifi dusts bookcases, chandeliers, and picture frames.',
    aliases: ['duster', 'fifi_duster', 'feather_duster'],
  },
  {
    id: 'fifi_garden',
    name: 'Garden Rake & Trowel',
    baseCost: 1100,
    costRatio: 1.15,
    baseProduction: 25.0,
    outputCurrency: 'gold',
    secondaryOutput: { currency: 'essence', rate: 0.1 },
    description: 'Fifi tends to the outdoor garden pathways with a rake.',
    aliases: ['garden_rake', 'rake', 'fifi_garden', 'fifi_rake', 'fifi_scrub'],
  },
  {
    id: 'fifi_kettle',
    name: 'Silver Tea Kettle',
    baseCost: 12000,
    costRatio: 1.15,
    baseProduction: 120.0,
    outputCurrency: 'gold',
    secondaryOutput: { currency: 'treats', rate: 0.05 },
    description: 'Fifi brews fragrant floral tea for Nyah and Master.',
    aliases: ['tea_kettle', 'kettle', 'fifi_kettle'],
  },
  {
    id: 'fifi_kitchen',
    name: 'Country Kitchen Stove',
    baseCost: 130000,
    costRatio: 1.15,
    baseProduction: 600.0,
    outputCurrency: 'gold',
    secondaryOutput: { currency: 'treats', rate: 0.1 },
    description: 'Fifi bakes warm cookies and maid treats in the kitchen stove.',
    aliases: ['kitchen_stove', 'stove', 'kitchen', 'fifi_kitchen', 'fifi_stove'],
  },
  {
    id: 'fifi_laundry',
    name: 'Copper Laundry Basin',
    baseCost: 1400000,
    costRatio: 1.15,
    baseProduction: 3200.0,
    outputCurrency: 'gold',
    description: 'Fifi hand-washes the estate curtains, linens, and maid aprons.',
    aliases: ['laundry_basin', 'laundry', 'fifi_laundry', 'wash_tub'],
  },
  {
    id: 'fifi_carriage',
    name: 'Polished Estate Carriage',
    baseCost: 20000000,
    costRatio: 1.15,
    baseProduction: 18000.0,
    outputCurrency: 'gold',
    description: 'Fifi drives estate deliveries to Whisker Town in the carriage.',
    aliases: ['carriage', 'fifi_carriage', 'estate_carriage'],
  },
  {
    id: 'fifi_vault',
    name: 'Royal Vault',
    baseCost: 330000000,
    costRatio: 1.15,
    baseProduction: 120000.0,
    outputCurrency: 'gold',
    secondaryOutput: { currency: 'essence', rate: 1.0 },
    description: 'Fifi polishes the gilded gold bars in Master’s royal vault.',
    aliases: ['royal_vault', 'vault', 'fifi_vault', 'fifi_observatory', 'brass_telescope'],
  },
];

const facilityMap = new Map<string, FacilityDefinition>();
for (const fac of FIFI_FACILITIES) {
  facilityMap.set(fac.id.toLowerCase(), fac);
  if (fac.aliases) {
    for (const alias of fac.aliases) {
      facilityMap.set(alias.toLowerCase(), fac);
    }
  }
}

export function findFacility(idOrAlias: string): FacilityDefinition | undefined {
  return facilityMap.get(idOrAlias.toLowerCase());
}

export function getAllFacilities(): FacilityDefinition[] {
  return [...FIFI_FACILITIES];
}
