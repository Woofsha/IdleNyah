// tests/unit/render_m3.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Container, Rectangle, Texture, TextureSource } from 'pixi.js';
import { EstateView } from '../../src/render/estate';
import { WorldView } from '../../src/render/world';
import { EffectsManager } from '../../src/render/effects';
import type { GameAssets } from '../../src/render/assets';

// Polyfill requestAnimationFrame / cancelAnimationFrame for headless Node environment
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}

function makeMockTexture(width: number, height: number): Texture {
  const source = new TextureSource({ width, height });
  return new Texture({ source, frame: new Rectangle(0, 0, width, height) });
}

function makeMockGameAssets(): GameAssets {
  const dummy = makeMockTexture(32, 32);
  const charDummy = makeMockTexture(48, 48);

  const directionDummy = {
    walk: [charDummy, charDummy, charDummy, charDummy],
    idle: charDummy,
  };

  const maidFrames = {
    down: directionDummy,
    up: directionDummy,
    left: directionDummy,
    action: [charDummy, charDummy, charDummy, charDummy],
  };

  return {
    nyahWorld: maidFrames,
    fifiWorld: maidFrames,
    nyahPortraitNative: dummy,
    fifiPortraitNative: dummy,
    nyahPortraitFull: dummy,
    fifiPortraitFull: dummy,
    groundTiles: {
      lawn: dummy,
      lawn2: dummy,
      lawn3: dummy,
      routegrass: dummy,
      tallgrass: dummy,
      forest: dummy,
      forest2: dummy,
      forest3: dummy,
      water: dummy,
      path: dummy,
      sand: dummy,
      pave: dummy,
      pave2: dummy,
      flower: dummy,
      shallow: dummy,
      lawn4: dummy,
    },
    buildings: {
      house_green: makeMockTexture(80, 64),
      house_mid: makeMockTexture(80, 56),
      house_red: makeMockTexture(80, 72),
      house_blue: makeMockTexture(80, 55),
      house_purple: makeMockTexture(80, 56),
      lab: makeMockTexture(112, 72),
      daycare: makeMockTexture(80, 72),
      fountain: [
        makeMockTexture(40, 45),
        makeMockTexture(40, 45),
        makeMockTexture(40, 45),
        makeMockTexture(40, 45),
        makeMockTexture(40, 45),
      ],
    },
    trees: {
      tree_round: makeMockTexture(32, 45),
      tree_narrow: makeMockTexture(16, 35),
      tree_bush: makeMockTexture(16, 21),
    },
  };
}

describe('Milestone 3: Mansion Evolution & 5 Outdoor Territory Zones Verification', () => {
  let assets: GameAssets;
  let groundLayer: Container;
  let entityLayer: Container;
  let effectsManager: EffectsManager;

  beforeEach(() => {
    assets = makeMockGameAssets();
    groundLayer = new Container();
    entityLayer = new Container({ sortableChildren: true });
    effectsManager = new EffectsManager();
  });

  describe('1. 5 Outdoor Territory Zones Initialization & Spatial Bounds', () => {
    it('creates all 5 distinct territory zones with proper initial lock state', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const zones = (estate as any).zones as Map<string, any>;
      expect(zones.size).toBe(5);
      expect(zones.has('zone_01_parlor')).toBe(true);
      expect(zones.has('zone_02_kitchen_garden')).toBe(true);
      expect(zones.has('zone_03_pond_courtyard')).toBe(true);
      expect(zones.has('zone_04_library_balcony')).toBe(true);
      expect(zones.has('zone_05_starlight_observatory')).toBe(true);

      // Zone 1 is unlocked by default, Zones 2-5 are locked with mist
      expect(zones.get('zone_01_parlor').unlocked).toBe(true);
      expect(zones.get('zone_02_kitchen_garden').unlocked).toBe(false);
      expect(zones.get('zone_03_pond_courtyard').unlocked).toBe(false);
      expect(zones.get('zone_04_library_balcony').unlocked).toBe(false);
      expect(zones.get('zone_05_starlight_observatory').unlocked).toBe(false);

      expect(zones.get('zone_02_kitchen_garden').mistContainer.visible).toBe(true);
      expect(zones.get('zone_03_pond_courtyard').mistContainer.visible).toBe(true);
    });

    it('calculates spatial bounds correctly across all 5 zones', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      // Initially only Zone 1 is unlocked
      const initialBounds = estate.getCombinedUnlockedBounds();
      expect(initialBounds).toEqual({
        minX: -192,
        maxX: 192,
        minY: -160,
        maxY: 160,
      });

      // Unlock all 5 zones
      estate.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ]);

      const expandedBounds = estate.getCombinedUnlockedBounds();
      expect(expandedBounds.minX).toBeLessThanOrEqual(-544); // Zone 4 reaches -544
      expect(expandedBounds.maxX).toBeGreaterThanOrEqual(544); // Zone 2 reaches 544
      expect(expandedBounds.minY).toBeLessThanOrEqual(-480); // Zone 5 reaches -480
      expect(expandedBounds.maxY).toBeGreaterThanOrEqual(480); // Zone 3 reaches 480
    });

    it('verifies zero interior coordinate overlaps and zero duplicate ground tiles between all territory zones', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const zones = Array.from(((estate as any).zones as Map<string, any>).values());

      // 1. Check bounding box intersections for interior overlap (area > 0)
      for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
          const b1 = zones[i].bounds;
          const b2 = zones[j].bounds;

          const overlapX = Math.max(0, Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX));
          const overlapY = Math.max(0, Math.min(b1.maxY, b2.maxY) - Math.max(b1.minY, b2.minY));
          const overlapArea = overlapX * overlapY;

          expect(overlapArea).toBe(0);
        }
      }

      // 2. Check that no two zones place ground tiles at the exact same (x, y) coordinates
      const tilePositions = new Map<string, string>();
      for (const zone of zones) {
        for (const child of zone.groundContainer.children) {
          const key = `${child.x},${child.y}`;
          expect(tilePositions.has(key)).toBe(false);
          tilePositions.set(key, zone.id);
        }
      }
    });
  });

  describe('2. Mansion Visual Tier Evolution (Tiers 1 to 5)', () => {
    it('evolves mansion texture and wings according to highest unlocked tier', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const mainSprite = (estate as any).mansionMainSprite;
      const westWing = (estate as any).mansionWestWing;
      const eastWing = (estate as any).mansionEastWing;
      const observatoryDome = (estate as any).mansionObservatoryDome;

      // Tier 1: Starter cottage
      estate.updateMansionTier(1);
      expect(estate.currentTier).toBe(1);
      expect(mainSprite.texture).toBe(assets.buildings.house_green);
      expect(westWing.visible).toBe(false);

      // Tier 2: Country villa
      estate.updateMansionTier(2);
      expect(estate.currentTier).toBe(2);
      expect(mainSprite.texture).toBe(assets.buildings.house_mid);

      // Tier 3: Grand manor
      estate.updateMansionTier(3);
      expect(estate.currentTier).toBe(3);
      expect(mainSprite.texture).toBe(assets.buildings.house_red);

      // Tier 4: Grand manor + West Wing (Library / Lab)
      estate.updateMansionTier(4);
      expect(estate.currentTier).toBe(4);
      expect(mainSprite.texture).toBe(assets.buildings.house_red);
      expect(westWing.visible).toBe(true);

      // Tier 5: Celestial chateau facade + West wing + East wing + Observatory dome
      estate.updateMansionTier(5);
      expect(estate.currentTier).toBe(5);
      expect(mainSprite.texture).toBe(assets.buildings.daycare);
      expect(westWing.visible).toBe(true);
      expect(eastWing.visible).toBe(true);
      expect(observatoryDome.visible).toBe(true);
    });

    it('cleanly resets wing visibility when downgrading from higher to lower tiers', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const westWing = (estate as any).mansionWestWing;
      const eastWing = (estate as any).mansionEastWing;
      const observatoryDome = (estate as any).mansionObservatoryDome;

      // Advance to Tier 5
      estate.updateMansionTier(5);
      expect(westWing.visible).toBe(true);
      expect(eastWing.visible).toBe(true);
      expect(observatoryDome.visible).toBe(true);

      // Downgrade to Tier 4
      estate.updateMansionTier(4);
      expect(westWing.visible).toBe(true);
      expect(eastWing.visible).toBe(false);
      expect(observatoryDome.visible).toBe(false);

      // Downgrade to Tier 3
      estate.updateMansionTier(3);
      expect(westWing.visible).toBe(false);
      expect(eastWing.visible).toBe(false);
      expect(observatoryDome.visible).toBe(false);

      // Downgrade to Tier 2
      estate.updateMansionTier(2);
      expect(westWing.visible).toBe(false);
      expect(eastWing.visible).toBe(false);
      expect(observatoryDome.visible).toBe(false);

      // Downgrade to Tier 1
      estate.updateMansionTier(1);
      expect(westWing.visible).toBe(false);
      expect(eastWing.visible).toBe(false);
      expect(observatoryDome.visible).toBe(false);
    });
  });

  describe('3. Courtyard Animated Fountain Cycle & Zone Unlocks', () => {
    it('animates fountain frames in Tier 3 courtyard', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const fountain = (estate as any).fountainSprite;
      expect(fountain.visible).toBe(false);

      // Unlock courtyard
      estate.setUnlockedZones(['zone_01_parlor', 'zone_03_pond_courtyard']);
      expect(fountain.visible).toBe(true);

      const frame0 = fountain.texture;
      // Advance by 0.15s (fountain timer >= 0.12s advances frame)
      estate.update(0.15);
      expect(fountain.texture).not.toBe(frame0);
    });

    it('handles alias zone_03_courtyard_pond gracefully', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      // Pass alias as used in user request
      estate.setUnlockedZones(['zone_01_parlor', 'zone_03_courtyard_pond']);
      const zones = (estate as any).zones as Map<string, any>;
      expect(zones.get('zone_03_pond_courtyard').unlocked).toBe(true);
      expect(estate.currentTier).toBe(3);
    });

    it('fades out mist over time upon unlock animation', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const zones = (estate as any).zones as Map<string, any>;
      const z2 = zones.get('zone_02_kitchen_garden');
      expect(z2.mistAlpha).toBe(1.0);

      estate.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden'], true);
      expect(z2.isFadingMist).toBe(true);

      // Advance by 0.5s
      estate.update(0.5);
      expect(z2.mistAlpha).toBeLessThan(1.0);
      expect(z2.mistAlpha).toBeGreaterThan(0);

      // Advance past full fade (1.0s more)
      estate.update(1.0);
      expect(z2.mistAlpha).toBe(0);
      expect(z2.isFadingMist).toBe(false);
      expect(z2.mistContainer.visible).toBe(false);
    });
  });

  describe('4. Dynamic Y-Depth Sorting & Structure ZIndex', () => {
    it('aligns building zIndex strictly to Math.floor(y) for depth perception', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const mainMansion = (estate as any).mansionMainSprite;
      const westWing = (estate as any).mansionWestWing;
      const observatoryDome = (estate as any).mansionObservatoryDome;

      expect(mainMansion.zIndex).toBe(0);
      expect(westWing.zIndex).toBe(-10);
      expect(observatoryDome.zIndex).toBe(-360);

      // Confirm sorted order: observatory (-360) -> westWing (-10) -> mainMansion (0)
      entityLayer.sortChildren();
      const zIndices = entityLayer.children.map((c) => c.zIndex);
      for (let i = 0; i < zIndices.length - 1; i++) {
        expect(zIndices[i]).toBeLessThanOrEqual(zIndices[i + 1]);
      }
    });
  });

  describe('5. Interactive Structure Clicks Detection', () => {
    it('triggers callback when interactive structures are clicked', () => {
      const clickedStructures: Array<{ type: string; x: number; y: number }> = [];

      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
        onStructureClick: (type, x, y) => {
          clickedStructures.push({ type, x, y });
        },
      });

      const mainMansion = (estate as any).mansionMainSprite;
      const fountain = (estate as any).fountainSprite;
      const westWing = (estate as any).mansionWestWing;
      const observatoryDome = (estate as any).mansionObservatoryDome;

      // Simulate pointerdown on mansion
      mainMansion.emit('pointerdown', {
        stopPropagation: () => {},
        global: { x: 0, y: 0 },
      });
      expect(clickedStructures).toHaveLength(1);
      expect(clickedStructures[0].type).toBe('mansion');

      // Simulate pointerdown on fountain
      fountain.emit('pointerdown', {
        stopPropagation: () => {},
        global: { x: 20, y: 300 },
      });
      expect(clickedStructures).toHaveLength(2);
      expect(clickedStructures[1].type).toBe('fountain');

      // Simulate pointerdown on library
      westWing.emit('pointerdown', {
        stopPropagation: () => {},
        global: { x: -240, y: -10 },
      });
      expect(clickedStructures).toHaveLength(3);
      expect(clickedStructures[2].type).toBe('library');

      // Simulate pointerdown on observatory
      observatoryDome.emit('pointerdown', {
        stopPropagation: () => {},
        global: { x: 16, y: -360 },
      });
      expect(clickedStructures).toHaveLength(4);
      expect(clickedStructures[3].type).toBe('observatory');
    });
  });
});
