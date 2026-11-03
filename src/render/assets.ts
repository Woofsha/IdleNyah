// src/render/assets.ts
import { Assets, Texture, Rectangle, TextureSource } from 'pixi.js';
import { getBespokeEstateAssets } from './bespokeAssets';

// Enforce nearest-neighbor filtering
TextureSource.defaultOptions.scaleMode = 'nearest';

export interface MaidDirectionFrames {
  walk: Texture[];
  idle: Texture;
}

export interface MaidCharacterFrames {
  down: MaidDirectionFrames;
  up: MaidDirectionFrames;
  left: MaidDirectionFrames;
  action: Texture[];
}

export interface GroundTilesMap {
  lawn: Texture;
  lawn2: Texture;
  lawn3: Texture;
  routegrass: Texture;
  tallgrass: Texture;
  forest: Texture;
  forest2: Texture;
  forest3: Texture;
  water: Texture;
  path: Texture;
  sand: Texture;
  pave: Texture;
  pave2: Texture;
  flower: Texture;
  shallow: Texture;
  lawn4: Texture;
  [key: string]: Texture;
}

export interface BuildingTexturesMap {
  house_green: Texture;
  house_mid: Texture;
  house_red: Texture;
  house_blue: Texture;
  house_purple: Texture;
  lab: Texture;
  daycare: Texture;
  fountain: Texture[];
  [key: string]: Texture | Texture[];
}

export interface TreeTexturesMap {
  tree_round: Texture;
  tree_narrow: Texture;
  tree_bush: Texture;
}

export interface GameAssets {
  nyahWorld: MaidCharacterFrames;
  fifiWorld: MaidCharacterFrames;
  nyahPortraitNative: Texture;
  fifiPortraitNative: Texture;
  nyahPortraitFull: Texture;
  fifiPortraitFull: Texture;
  groundTiles: GroundTilesMap;
  buildings: BuildingTexturesMap;
  trees: TreeTexturesMap;
}

/**
 * Creates a sub-texture slice from a base texture using integer pixel bounds.
 */
export function createSubTexture(baseTexture: Texture, x: number, y: number, w: number, h: number): Texture {
  return new Texture({
    source: baseTexture.source,
    frame: new Rectangle(x, y, w, h),
  });
}

/**
 * Slices 48x48 character frames from a 144x192 sprite sheet (3 cols x 4 rows).
 *
 * Row 0: Facing South (Down)
 * Row 1: Facing North (Up)
 * Row 2: Facing West (Left) (Right is handled via scale.x = -1)
 * Row 3: Action / Special Chores
 *
 * Columns: 0 = step left, 1 = neutral/idle, 2 = step right
 * Walk cycle sequence: [step_left, idle, step_right, idle]
 */
export function sliceCharacterSheet(baseSheet: Texture): MaidCharacterFrames {
  const cell = 48;

  // Row 0: Down
  const downWalk1 = createSubTexture(baseSheet, 0 * cell, 0 * cell, cell, cell);
  const downIdle = createSubTexture(baseSheet, 1 * cell, 0 * cell, cell, cell);
  const downWalk2 = createSubTexture(baseSheet, 2 * cell, 0 * cell, cell, cell);

  // Row 1: Up
  const upWalk1 = createSubTexture(baseSheet, 0 * cell, 1 * cell, cell, cell);
  const upIdle = createSubTexture(baseSheet, 1 * cell, 1 * cell, cell, cell);
  const upWalk2 = createSubTexture(baseSheet, 2 * cell, 1 * cell, cell, cell);

  // Row 2: Left
  const leftWalk1 = createSubTexture(baseSheet, 0 * cell, 2 * cell, cell, cell);
  const leftIdle = createSubTexture(baseSheet, 1 * cell, 2 * cell, cell, cell);
  const leftWalk2 = createSubTexture(baseSheet, 2 * cell, 2 * cell, cell, cell);

  // Row 3: Action
  const action0 = createSubTexture(baseSheet, 0 * cell, 3 * cell, cell, cell);
  const action1 = createSubTexture(baseSheet, 1 * cell, 3 * cell, cell, cell);
  const action2 = createSubTexture(baseSheet, 2 * cell, 3 * cell, cell, cell);

  return {
    down: {
      walk: [downWalk1, downIdle, downWalk2, downIdle],
      idle: downIdle,
    },
    up: {
      walk: [upWalk1, upIdle, upWalk2, upIdle],
      idle: upIdle,
    },
    left: {
      walk: [leftWalk1, leftIdle, leftWalk2, leftIdle],
      idle: leftIdle,
    },
    action: [action0, action1, action2, action1],
  };
}

/**
 * Slices 32x32 terrain tiles from frlg_blocks.png (256x64 px, 8 cols x 2 rows).
 */
export function sliceGroundBlocks(blocksTexture: Texture): GroundTilesMap {
  const blockPx = 32;
  const tileNames: (keyof GroundTilesMap)[] = [
    'lawn', 'lawn2', 'lawn3', 'routegrass', 'tallgrass', 'forest', 'forest2', 'forest3',
    'water', 'path', 'sand', 'pave', 'pave2', 'flower', 'shallow', 'lawn4',
  ];

  const map: Partial<GroundTilesMap> = {};

  tileNames.forEach((name, index) => {
    const col = index % 8;
    const row = Math.floor(index / 8);
    map[name] = createSubTexture(blocksTexture, col * blockPx, row * blockPx, blockPx, blockPx);
  });

  return map as GroundTilesMap;
}

/**
 * Slices buildings from frlg_buildings.png using pixel metadata.
 */
export function sliceBuildings(buildingsTexture: Texture): BuildingTexturesMap {
  return {
    house_green: createSubTexture(buildingsTexture, 0, 0, 80, 64),
    house_mid: createSubTexture(buildingsTexture, 84, 0, 80, 56),
    house_red: createSubTexture(buildingsTexture, 168, 0, 80, 72),
    house_blue: createSubTexture(buildingsTexture, 252, 0, 80, 55),
    house_purple: createSubTexture(buildingsTexture, 168, 76, 80, 56),
    lab: createSubTexture(buildingsTexture, 152, 152, 112, 72),
    daycare: createSubTexture(buildingsTexture, 0, 228, 80, 72),
    fountain: [
      createSubTexture(buildingsTexture, 108, 228, 40, 45),
      createSubTexture(buildingsTexture, 152, 228, 40, 45),
      createSubTexture(buildingsTexture, 196, 228, 40, 45),
      createSubTexture(buildingsTexture, 240, 228, 40, 45),
      createSubTexture(buildingsTexture, 284, 228, 40, 45),
    ],
  };
}

/**
 * Slices trees from frlg_trees.png.
 */
export function sliceTrees(treesTexture: Texture): TreeTexturesMap {
  return {
    tree_round: createSubTexture(treesTexture, 2, 2, 32, 45),
    tree_narrow: createSubTexture(treesTexture, 36, 2, 16, 35),
    tree_bush: createSubTexture(treesTexture, 54, 2, 16, 21),
  };
}

let loadedGameAssets: GameAssets | null = null;

/**
 * Loads all IdleNyah game assets and initializes sliced sub-textures.
 */
export async function loadGameAssets(basePath = './assets/'): Promise<GameAssets> {
  if (loadedGameAssets) return loadedGameAssets;

  TextureSource.defaultOptions.scaleMode = 'nearest';

  await Assets.init({
    basePath,
  });

  // Load raw textures
  const [
    nyahWorldRaw,
    fifiWorldRaw,
    nyahPortraitNative,
    fifiPortraitNative,
    nyahPortraitFull,
    fifiPortraitFull,
    frlgBlocksRaw,
    frlgBuildingsRaw,
    frlgTreesRaw,
  ] = await Promise.all([
    Assets.load<Texture>('characters/nyah_world.png'),
    Assets.load<Texture>('characters/fifi_world.png'),
    Assets.load<Texture>('portraits/nyah_native.png'),
    Assets.load<Texture>('portraits/fifi_native.png'),
    Assets.load<Texture>('portraits/nyah_full.png'),
    Assets.load<Texture>('portraits/fifi_full.png'),
    Assets.load<Texture>('tiles/frlg_blocks.png'),
    Assets.load<Texture>('tiles/frlg_buildings.png'),
    Assets.load<Texture>('tiles/frlg_trees.png'),
  ]);

  // Ensure scale mode is nearest
  [
    nyahWorldRaw,
    fifiWorldRaw,
    nyahPortraitNative,
    fifiPortraitNative,
    nyahPortraitFull,
    fifiPortraitFull,
    frlgBlocksRaw,
    frlgBuildingsRaw,
    frlgTreesRaw,
  ].forEach((t) => {
    if (t?.source) {
      t.source.scaleMode = 'nearest';
    }
  });

  // Slice textures into structured assets
  const nyahWorld = sliceCharacterSheet(nyahWorldRaw);
  const fifiWorld = sliceCharacterSheet(fifiWorldRaw);
  const groundTiles = sliceGroundBlocks(frlgBlocksRaw);
  const buildings = sliceBuildings(frlgBuildingsRaw);
  const trees = sliceTrees(frlgTreesRaw);

  // Replace placeholder/borrowed tiles & buildings with cohesive bespoke pixel art
  const bespoke = getBespokeEstateAssets();
  buildings.house_green = bespoke.cottage;
  buildings.house_mid = bespoke.villa;
  buildings.house_red = bespoke.manor;
  buildings.lab = bespoke.library;
  buildings.daycare = bespoke.observatory;
  buildings.house_blue = bespoke.observatory;
  buildings.house_purple = bespoke.villa;

  trees.tree_round = bespoke.tree;
  trees.tree_narrow = bespoke.tree;
  trees.tree_bush = bespoke.bush;

  groundTiles.lawn = bespoke.lawn;
  groundTiles.lawn2 = bespoke.lawn;
  groundTiles.lawn3 = bespoke.lawn;
  groundTiles.lawn4 = bespoke.lawn;
  groundTiles.routegrass = bespoke.lawn;
  groundTiles.tallgrass = bespoke.lawn;
  groundTiles.forest = bespoke.lawn;
  groundTiles.forest2 = bespoke.lawn;
  groundTiles.forest3 = bespoke.lawn;
  groundTiles.path = bespoke.path;
  groundTiles.pave = bespoke.path;
  groundTiles.pave2 = bespoke.path;
  groundTiles.flower = bespoke.lawnFlowers;
  groundTiles.sand = bespoke.porchWood;
  groundTiles.water = bespoke.water;
  groundTiles.shallow = bespoke.water;

  loadedGameAssets = {
    nyahWorld,
    fifiWorld,
    nyahPortraitNative,
    fifiPortraitNative,
    nyahPortraitFull,
    fifiPortraitFull,
    groundTiles,
    buildings,
    trees,
  };

  return loadedGameAssets;
}

/**
 * Returns cached game assets if loaded.
 */
export function getGameAssets(): GameAssets {
  if (!loadedGameAssets) {
    throw new Error('Game assets not yet loaded. Call loadGameAssets() first.');
  }
  return loadedGameAssets;
}
