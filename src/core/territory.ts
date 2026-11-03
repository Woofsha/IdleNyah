// src/core/territory.ts
import { TerritoryZoneDefinition, CurrenciesState } from './types';

export const TERRITORY_ZONES: TerritoryZoneDefinition[] = [
  {
    id: 'zone_01_parlor',
    name: 'Dusty Parlor & Starter Porch',
    tier: 1,
    costGold: 0,
    costTreats: 0,
    costEssence: 0,
    description: 'A modest maid cottage with wooden floorboards and a weathered front porch.',
    habitatId: 'habitat_porch',
    habitatName: 'Porch Baskets',
    habitatCapacity: 3,
    productionBonus: {
      goldMultiplier: 1.0,
      clickMultiplier: 1.0,
    },
    aliases: ['parlor', 'cottage', 'yard', 'zone_01_parlor', 'tier_1_parlor'],
  },
  {
    id: 'zone_02_kitchen_garden',
    name: 'Country Kitchen & Herb Garden',
    tier: 2,
    costGold: 500,
    costTreats: 0,
    costEssence: 0,
    prerequisiteZoneId: 'zone_01_parlor',
    prerequisiteChores: 25,
    description: 'Sunny garden plots and a warm hearth oven for baking catnip cookies.',
    habitatId: 'habitat_garden',
    habitatName: 'Herb Garden Pen',
    habitatCapacity: 4,
    productionBonus: {
      goldMultiplier: 1.15,
      clickMultiplier: 1.10,
    },
    aliases: ['kitchen_garden', 'garden', 'gardens', 'zone_02_kitchen_garden', 'tier_2_kitchen'],
  },
  {
    id: 'zone_03_pond_courtyard',
    name: 'Cobblestone Courtyard & Whispering Pond',
    tier: 3,
    costGold: 7500,
    costTreats: 30,
    costEssence: 0,
    prerequisiteZoneId: 'zone_02_kitchen_garden',
    description: 'Paved courtyard featuring a serene pond with blooming water lilies.',
    habitatId: 'habitat_pond',
    habitatName: 'Whispering Pond',
    habitatCapacity: 6,
    productionBonus: {
      goldMultiplier: 1.25,
      essenceMultiplier: 1.20,
    },
    aliases: ['pond_courtyard', 'pond', 'courtyard', 'zone_03_pond_courtyard', 'tier_3_pond'],
  },
  {
    id: 'zone_04_library_balcony',
    name: 'Royal Library & Sunlit Balcony',
    tier: 4,
    costGold: 85000,
    costTreats: 0,
    costEssence: 200,
    prerequisiteZoneId: 'zone_03_pond_courtyard',
    description: 'Two-story mahogany library with Nyah’s cat throne and open aviary balconies.',
    habitatId: 'habitat_aviary',
    habitatName: 'Aviary Perch',
    habitatCapacity: 4,
    productionBonus: {
      goldMultiplier: 1.35,
      essenceMultiplier: 1.25,
      clickMultiplier: 1.15,
    },
    aliases: [
      'library_balcony',
      'sanctuary',
      'whispering_woods',
      'zone_04_library_balcony',
      'zone_04_sanctuary',
      'tier_4_sanctuary',
    ],
  },
  {
    id: 'zone_05_starlight_observatory',
    name: 'Starlight Observatory & Grand Sanctuary',
    tier: 5,
    costGold: 1250000,
    costTreats: 150,
    costEssence: 2500,
    prerequisiteZoneId: 'zone_04_library_balcony',
    description: 'Glass-domed observatory overlooking a glowing meadow of celestial fauna.',
    habitatId: 'habitat_sanctuary',
    habitatName: 'Grand Sanctuary',
    habitatCapacity: 12,
    productionBonus: {
      goldMultiplier: 1.50,
      essenceMultiplier: 1.50,
      clickMultiplier: 1.25,
    },
    aliases: [
      'starlight_observatory',
      'observatory',
      'celestial_meadow',
      'zone_05_starlight_observatory',
      'zone_05_orchard_sanctuary',
      'zone_06_starlight_observatory',
      'tier_5_observatory',
    ],
  },
];

const zoneMap = new Map<string, TerritoryZoneDefinition>();
for (const zone of TERRITORY_ZONES) {
  zoneMap.set(zone.id.toLowerCase(), zone);
  if (zone.aliases) {
    for (const alias of zone.aliases) {
      zoneMap.set(alias.toLowerCase(), zone);
    }
  }
}

export function findZone(idOrAlias: string): TerritoryZoneDefinition | undefined {
  return zoneMap.get(idOrAlias.toLowerCase());
}

export function getAllZones(): TerritoryZoneDefinition[] {
  return [...TERRITORY_ZONES];
}

export function checkZoneUnlockPrerequisites(
  zone: TerritoryZoneDefinition,
  unlockedZones: string[],
  totalClicks: number,
  currencies: CurrenciesState
): { canUnlock: boolean; reason?: string } {
  if (unlockedZones.includes(zone.id)) {
    return { canUnlock: false, reason: 'Already unlocked' };
  }

  if (zone.prerequisiteZoneId && !unlockedZones.includes(zone.prerequisiteZoneId)) {
    const prereq = findZone(zone.prerequisiteZoneId);
    return {
      canUnlock: false,
      reason: `Requires prerequisite zone: ${prereq ? prereq.name : zone.prerequisiteZoneId}`,
    };
  }

  if (zone.prerequisiteChores && totalClicks < zone.prerequisiteChores) {
    return {
      canUnlock: false,
      reason: `Requires ${zone.prerequisiteChores} chores completed (currently ${totalClicks})`,
    };
  }

  if (currencies.gold < zone.costGold) {
    return { canUnlock: false, reason: `Insufficient gold: need ${zone.costGold}, have ${currencies.gold}` };
  }

  if (currencies.treats < zone.costTreats) {
    return { canUnlock: false, reason: `Insufficient treats: need ${zone.costTreats}, have ${currencies.treats}` };
  }

  if (currencies.essence < zone.costEssence) {
    return { canUnlock: false, reason: `Insufficient essence: need ${zone.costEssence}, have ${currencies.essence}` };
  }

  return { canUnlock: true };
}
