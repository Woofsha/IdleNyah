// src/core/creatures.ts
import { CreatureSpeciesDefinition, HabitatDefinition, CatchResult } from './types';
import { DeterministicRNG } from './math';

export const CREATURE_SPECIES: CreatureSpeciesDefinition[] = [
  {
    id: 'purrble',
    name: 'Purrble',
    tier: 'common',
    spawnZoneId: 'zone_01_parlor',
    baseCatchRate: 0.65,
    goldPerSec: 1.0,
    treatsPerSec: 0,
    essencePerSec: 0,
    clickBonusPercent: 0.05,
    preferredHabitatId: 'habitat_porch',
    description: 'A round pastel-lavender dust-bunny kitten that sweeps floor crumbs.',
    aliases: ['dust_bunny', 'purrble'],
  },
  {
    id: 'barkling',
    name: 'Barkling',
    tier: 'common',
    spawnZoneId: 'zone_02_kitchen_garden',
    baseCatchRate: 0.65,
    goldPerSec: 3.0,
    treatsPerSec: 0.02,
    essencePerSec: 0,
    clickBonusPercent: 0,
    preferredHabitatId: 'habitat_garden',
    description: 'An acorn-shaped golden puppy with sprout ears who unearths fertile seeds.',
    aliases: ['sproutling', 'barkling'],
  },
  {
    id: 'mooshrum',
    name: 'Mooshrum',
    tier: 'common',
    spawnZoneId: 'zone_02_kitchen_garden',
    baseCatchRate: 0.55,
    goldPerSec: 8.0,
    treatsPerSec: 0.05,
    essencePerSec: 0,
    clickBonusPercent: 0,
    preferredHabitatId: 'habitat_garden',
    description: 'A miniature dairy heifer with a red spotted mushroom cap producing sweet cream.',
    aliases: ['fuzzy_grub', 'mooshrum'],
  },
  {
    id: 'glimmerfin',
    name: 'Glimmerfin',
    tier: 'uncommon',
    spawnZoneId: 'zone_03_pond_courtyard',
    baseCatchRate: 0.40,
    goldPerSec: 25.0,
    treatsPerSec: 0,
    essencePerSec: 0.20,
    clickBonusPercent: 0,
    preferredHabitatId: 'habitat_pond',
    description: 'A translucent teal-and-gold aquatic sprite who filters fresh fountain spring water.',
    aliases: ['puddle_duck', 'glimmerfin'],
  },
  {
    id: 'silkwisp',
    name: 'Silkwisp',
    tier: 'uncommon',
    spawnZoneId: 'zone_03_pond_courtyard',
    baseCatchRate: 0.40,
    goldPerSec: 35.0,
    treatsPerSec: 0.10,
    essencePerSec: 0.10,
    clickBonusPercent: 0,
    preferredHabitatId: 'habitat_pond',
    description: 'An alabaster yarn moth with glowing antennae who spins silk for maid uniforms.',
    aliases: ['lilypuff', 'silkwisp'],
  },
  {
    id: 'cinderfox',
    name: 'Cinderfox',
    tier: 'rare',
    spawnZoneId: 'zone_04_library_balcony',
    baseCatchRate: 0.22,
    goldPerSec: 120.0,
    treatsPerSec: 0,
    essencePerSec: 0.50,
    clickBonusPercent: 0,
    preferredHabitatId: 'habitat_aviary',
    description: 'A playful terracotta fox with ember paws who warms stoves and fireplaces.',
    aliases: ['breeze_finch', 'cinderfox'],
  },
  {
    id: 'bramblebeast',
    name: 'Bramblebeast',
    tier: 'rare',
    spawnZoneId: 'zone_04_library_balcony',
    baseCatchRate: 0.22,
    goldPerSec: 250.0,
    treatsPerSec: 0.20,
    essencePerSec: 0.30,
    clickBonusPercent: 0,
    preferredHabitatId: 'habitat_aviary',
    description: 'An emerald-green hedgehog covered in blooming sweet blackberry vines.',
    aliases: ['ember_pup', 'bramblebeast'],
  },
  {
    id: 'chrono_chirp',
    name: 'Chrono-Chirp',
    tier: 'rare',
    spawnZoneId: 'zone_05_starlight_observatory',
    baseCatchRate: 0.18,
    goldPerSec: 450.0,
    treatsPerSec: 0.50,
    essencePerSec: 1.0,
    clickBonusPercent: 0,
    preferredHabitatId: 'habitat_sanctuary',
    description: 'A clockwork brass-feathered pocket owl who accelerates time flow.',
    aliases: ['chrono_chirp', 'pocket_owl'],
  },
  {
    id: 'dewdrop_slime',
    name: 'Dewdrop Slime',
    tier: 'rare',
    spawnZoneId: 'zone_05_starlight_observatory',
    baseCatchRate: 0.15,
    goldPerSec: 800.0,
    treatsPerSec: 0.50,
    essencePerSec: 1.5,
    clickBonusPercent: 0,
    preferredHabitatId: 'habitat_sanctuary',
    description: 'A translucent sky-blue jelly maidling carrying a tiny wash bucket.',
    aliases: ['dewdrop_slime', 'slime'],
  },
  {
    id: 'starling_doe',
    name: 'Starling Doe',
    tier: 'mythic',
    spawnZoneId: 'zone_05_starlight_observatory',
    baseCatchRate: 0.08,
    goldPerSec: 2500.0,
    treatsPerSec: 1.0,
    essencePerSec: 2.5,
    clickBonusPercent: 0.10,
    preferredHabitatId: 'habitat_sanctuary',
    description: 'An ethereal astral fawn with crystalline antlers blessing the entire estate.',
    aliases: ['star_cat', 'starling_doe', 'astral_fawn'],
  },
];

export const HABITATS: HabitatDefinition[] = [
  { id: 'habitat_porch', name: 'Porch Baskets', zoneId: 'zone_01_parlor', capacity: 3 },
  { id: 'habitat_garden', name: 'Herb Garden Pen', zoneId: 'zone_02_kitchen_garden', capacity: 4 },
  { id: 'habitat_pond', name: 'Whispering Pond', zoneId: 'zone_03_pond_courtyard', capacity: 6 },
  { id: 'habitat_aviary', name: 'Aviary Perch', zoneId: 'zone_04_library_balcony', capacity: 4 },
  { id: 'habitat_sanctuary', name: 'Grand Sanctuary', zoneId: 'zone_05_starlight_observatory', capacity: 12 },
];

const speciesMap = new Map<string, CreatureSpeciesDefinition>();
for (const spec of CREATURE_SPECIES) {
  speciesMap.set(spec.id.toLowerCase(), spec);
  if (spec.aliases) {
    for (const alias of spec.aliases) {
      speciesMap.set(alias.toLowerCase(), spec);
    }
  }
}

const habitatMap = new Map<string, HabitatDefinition>();
for (const hab of HABITATS) {
  habitatMap.set(hab.id.toLowerCase(), hab);
}

export function findSpecies(idOrAlias: string): CreatureSpeciesDefinition | undefined {
  return speciesMap.get(idOrAlias.toLowerCase());
}

export function getAllSpecies(): CreatureSpeciesDefinition[] {
  return [...CREATURE_SPECIES];
}

export function findHabitat(habitatId: string): HabitatDefinition | undefined {
  return habitatMap.get(habitatId.toLowerCase());
}

export function getAllHabitats(): HabitatDefinition[] {
  return [...HABITATS];
}

export function getSpeciesForZone(zoneId: string): CreatureSpeciesDefinition[] {
  return CREATURE_SPECIES.filter(
    (s) => s.spawnZoneId.toLowerCase() === zoneId.toLowerCase()
  );
}

/**
 * Calculates catch chance and evaluates catch attempt.
 */
export function calculateCatchRoll(
  species: CreatureSpeciesDefinition,
  useBait: boolean,
  rng: DeterministicRNG | { next(): number }
): CatchResult {
  const baitBonus = useBait ? 0.35 : 0.0;
  const finalCatchRate = Math.min(0.95, species.baseCatchRate * (1.0 + baitBonus));
  const roll = rng.next();

  if (roll < finalCatchRate) {
    const isShiny = rng.next() < 0.05;
    return {
      success: true,
      speciesId: species.id,
      isShiny,
    };
  } else {
    // Determine flee chance
    const fleeChance = useBait ? 0.10 : 0.30;
    const fleeRoll = rng.next();
    return {
      success: false,
      speciesId: species.id,
      fled: fleeRoll < fleeChance,
    };
  }
}

/**
 * Computes production for an assigned creature based on level.
 * Level bonus = 1 + 0.20 * (level - 1)
 */
export function calculateCreatureProduction(
  species: CreatureSpeciesDefinition,
  count: number,
  level: number
): { gold: number; treats: number; essence: number; clickBonus: number } {
  if (count <= 0) return { gold: 0, treats: 0, essence: 0, clickBonus: 0 };
  const levelMult = 1.0 + 0.20 * Math.max(0, level - 1);
  return {
    gold: count * species.goldPerSec * levelMult,
    treats: count * species.treatsPerSec * levelMult,
    essence: count * species.essencePerSec * levelMult,
    clickBonus: count * species.clickBonusPercent,
  };
}
