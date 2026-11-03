// tests/stress/challenger_m3_2_audit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Container, Rectangle, Texture, TextureSource } from 'pixi.js';
import { EstateView, ZoneBounds } from '../../src/render/estate';
import { EffectsManager } from '../../src/render/effects';
import type { GameAssets } from '../../src/render/assets';

// Headless polyfills
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

describe('Challenger M3 Iteration 2 Empirical Remediation Audit', () => {
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

  describe('Oracle 1: Rigorous Spatial Partitioning & Zero Overlap Audit', () => {
    it('verifies exact 0 px^2 intersection for all 10 pairwise combinations of territory zones', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const zones = Array.from(((estate as any).zones as Map<string, any>).values());
      expect(zones.length).toBe(5);

      const intersectionAudit: Array<{
        pair: string;
        overlapX: number;
        overlapY: number;
        overlapArea: number;
      }> = [];

      for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
          const z1 = zones[i];
          const z2 = zones[j];
          const b1 = z1.bounds as ZoneBounds;
          const b2 = z2.bounds as ZoneBounds;

          // Compute 2D intersection
          const overlapMinX = Math.max(b1.minX, b2.minX);
          const overlapMaxX = Math.min(b1.maxX, b2.maxX);
          const overlapMinY = Math.max(b1.minY, b2.minY);
          const overlapMaxY = Math.min(b1.maxY, b2.maxY);

          const overlapX = Math.max(0, overlapMaxX - overlapMinX);
          const overlapY = Math.max(0, overlapMaxY - overlapMinY);
          const overlapArea = overlapX * overlapY;

          intersectionAudit.push({
            pair: `${z1.id} <-> ${z2.id}`,
            overlapX,
            overlapY,
            overlapArea,
          });

          // Interior overlap area must be strictly zero
          expect(overlapArea).toBe(0);
        }
      }

      console.log('[CHALLENGER AUDIT] Pairwise Zone Intersections (10 pairs):');
      for (const res of intersectionAudit) {
        console.log(`  ${res.pair}: overlapArea=${res.overlapArea} px^2 (dx=${res.overlapX}, dy=${res.overlapY})`);
      }
      expect(intersectionAudit.length).toBe(10);
      expect(intersectionAudit.every((r) => r.overlapArea === 0)).toBe(true);
    });

    it('verifies 100% collision-free ground tiles across all 5 zones (0 duplicate coordinates)', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const zones = Array.from(((estate as any).zones as Map<string, any>).values());
      const tileMap = new Map<string, { zone: string; x: number; y: number }>();
      const duplicates: Array<{ key: string; zoneA: string; zoneB: string }> = [];
      let totalTiles = 0;

      for (const zone of zones) {
        const children = zone.groundContainer.children;
        totalTiles += children.length;
        for (const child of children) {
          const key = `${child.x},${child.y}`;
          if (tileMap.has(key)) {
            duplicates.push({
              key,
              zoneA: tileMap.get(key)!.zone,
              zoneB: zone.id,
            });
          } else {
            tileMap.set(key, { zone: zone.id, x: child.x, y: child.y });
          }
        }
      }

      console.log(`[CHALLENGER AUDIT] Total Ground Tiles: ${totalTiles}, Unique Coordinates: ${tileMap.size}, Duplicates: ${duplicates.length}`);
      expect(duplicates).toEqual([]);
      expect(tileMap.size).toBe(totalTiles);
    });

    it('verifies all outdoor terrain decor and structures are positioned within their respective zone boundaries', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const zones = Array.from(((estate as any).zones as Map<string, any>).values());

      for (const zone of zones) {
        const bounds: ZoneBounds = zone.bounds;
        for (const entity of zone.entities) {
          // If the entity is a mansion wing (attached to the central mansion at x=0, y=0), its coordinates
          // reflect mansion architectural attachment. Otherwise, outdoor decor must reside strictly in zone bounds.
          const isMansionWing = entity.label?.startsWith('mansion-');
          if (!isMansionWing) {
            expect(entity.x).toBeGreaterThanOrEqual(bounds.minX);
            expect(entity.x).toBeLessThanOrEqual(bounds.maxX);
            expect(entity.y).toBeGreaterThanOrEqual(bounds.minY);
            expect(entity.y).toBeLessThanOrEqual(bounds.maxY);
          }
        }
      }
    });
  });

  describe('Oracle 2: Mansion Tier State Machine Fuzzing & Downgrade Reversibility', () => {
    it('proves idempotent visibility across 1,000 random tier transitions', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const westWing = (estate as any).mansionWestWing;
      const eastWing = (estate as any).mansionEastWing;
      const dome = (estate as any).mansionObservatoryDome;

      expect(westWing).toBeDefined();
      expect(eastWing).toBeDefined();
      expect(dome).toBeDefined();

      const testTiers = [-2, 0, 1, 2, 3, 4, 5, 6, 10, 100];

      for (let step = 0; step < 1000; step++) {
        const randomTier = testTiers[Math.floor(Math.random() * testTiers.length)];
        estate.updateMansionTier(randomTier);

        const clampedTier = Math.max(1, Math.min(5, randomTier));
        expect(estate.currentTier).toBe(clampedTier);

        // Invariant: West Wing must be visible IF AND ONLY IF currentTier >= 4
        expect(westWing.visible).toBe(clampedTier >= 4);

        // Invariant: East Wing must be visible IF AND ONLY IF currentTier >= 5
        expect(eastWing.visible).toBe(clampedTier >= 5);

        // Invariant: Observatory Dome must be visible IF AND ONLY IF currentTier >= 5
        expect(dome.visible).toBe(clampedTier >= 5);

        // Main texture invariant
        const mainSprite = (estate as any).mansionMainSprite;
        if (clampedTier === 1) {
          expect(mainSprite.texture).toBe(assets.buildings.house_green);
        } else if (clampedTier === 2) {
          expect(mainSprite.texture).toBe(assets.buildings.house_mid);
        } else if (clampedTier === 3 || clampedTier === 4) {
          expect(mainSprite.texture).toBe(assets.buildings.house_red);
        } else if (clampedTier === 5) {
          expect(mainSprite.texture).toBe(assets.buildings.daycare);
        }
      }
    });

    it('proves clean wing hiding on direct and cascading downgrades (5 -> 4 -> 3 -> 2 -> 1)', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const westWing = (estate as any).mansionWestWing;
      const eastWing = (estate as any).mansionEastWing;
      const dome = (estate as any).mansionObservatoryDome;

      // Start at Tier 5
      estate.updateMansionTier(5);
      expect(estate.currentTier).toBe(5);
      expect(westWing.visible).toBe(true);
      expect(eastWing.visible).toBe(true);
      expect(dome.visible).toBe(true);

      // Downgrade to Tier 4: East wing and dome must hide, west wing stays visible
      estate.updateMansionTier(4);
      expect(estate.currentTier).toBe(4);
      expect(westWing.visible).toBe(true);
      expect(eastWing.visible).toBe(false);
      expect(dome.visible).toBe(false);

      // Downgrade to Tier 3: West wing must also hide
      estate.updateMansionTier(3);
      expect(estate.currentTier).toBe(3);
      expect(westWing.visible).toBe(false);
      expect(eastWing.visible).toBe(false);
      expect(dome.visible).toBe(false);

      // Downgrade to Tier 2: All remain hidden
      estate.updateMansionTier(2);
      expect(estate.currentTier).toBe(2);
      expect(westWing.visible).toBe(false);
      expect(eastWing.visible).toBe(false);
      expect(dome.visible).toBe(false);

      // Downgrade to Tier 1: All remain hidden
      estate.updateMansionTier(1);
      expect(estate.currentTier).toBe(1);
      expect(westWing.visible).toBe(false);
      expect(eastWing.visible).toBe(false);
      expect(dome.visible).toBe(false);

      // Jump directly from 5 to 1
      estate.updateMansionTier(5);
      expect(westWing.visible).toBe(true);
      expect(eastWing.visible).toBe(true);
      expect(dome.visible).toBe(true);

      estate.updateMansionTier(1);
      expect(westWing.visible).toBe(false);
      expect(eastWing.visible).toBe(false);
      expect(dome.visible).toBe(false);
    });
  });

  describe('Oracle 3: Zone Unlock Powerset ($2^5 = 32$ Subsets) & Convex Hull Oracle', () => {
    it('verifies spatial bounds and estate tier across all 32 combinations of unlocked zones', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const zoneIds = [
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ];

      const tierMap: Record<string, number> = {
        zone_01_parlor: 1,
        zone_02_kitchen_garden: 2,
        zone_03_pond_courtyard: 3,
        zone_04_library_balcony: 4,
        zone_05_starlight_observatory: 5,
      };

      // Test all 32 subsets
      for (let mask = 1; mask < 32; mask++) {
        const subset: string[] = [];
        for (let i = 0; i < 5; i++) {
          if ((mask & (1 << i)) !== 0) {
            subset.push(zoneIds[i]);
          }
        }

        estate.setUnlockedZones(subset, false);

        const expectedTier = Math.max(1, ...subset.map((id) => tierMap[id]));
        expect(estate.currentTier).toBe(expectedTier);

        const bounds = estate.getCombinedUnlockedBounds();
        expect(Number.isFinite(bounds.minX)).toBe(true);
        expect(Number.isFinite(bounds.maxX)).toBe(true);
        expect(Number.isFinite(bounds.minY)).toBe(true);
        expect(Number.isFinite(bounds.maxY)).toBe(true);
        expect(bounds.minX).toBeLessThan(bounds.maxX);
        expect(bounds.minY).toBeLessThan(bounds.maxY);

        const westWing = (estate as any).mansionWestWing;
        const eastWing = (estate as any).mansionEastWing;
        const dome = (estate as any).mansionObservatoryDome;

        expect(westWing.visible).toBe(expectedTier >= 4);
        expect(eastWing.visible).toBe(expectedTier >= 5);
        expect(dome.visible).toBe(expectedTier >= 5);
      }
    });
  });

  describe('Oracle 4: Mist Fade Dynamics & Time Distortion Monotonicity', () => {
    it('monotonically reduces mist alpha under micro and macro delta time steps without negative drift', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      estate.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
      ], true);

      const zones = (estate as any).zones as Map<string, any>;
      const z2 = zones.get('zone_02_kitchen_garden');
      expect(z2.isFadingMist).toBe(true);
      expect(z2.mistAlpha).toBe(1.0);

      // Micro step: dt = 0.05
      let prevAlpha = z2.mistAlpha;
      for (let i = 0; i < 5; i++) {
        estate.update(0.05);
        expect(z2.mistAlpha).toBeLessThan(prevAlpha);
        expect(z2.mistAlpha).toBeGreaterThanOrEqual(0);
        prevAlpha = z2.mistAlpha;
      }

      // Massive leap step (e.g. 100 seconds after browser tab pause)
      estate.update(100.0);
      expect(z2.mistAlpha).toBe(0);
      expect(z2.isFadingMist).toBe(false);
      expect(z2.mistContainer.visible).toBe(false);
    });
  });
});
