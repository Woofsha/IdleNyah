// tests/unit/spatial_contract.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { CollisionRegistry } from '../../src/render/collisionRegistry';
import { EstateView } from '../../src/render/estate';
import { MaidSprite } from '../../src/render/maids';
import { EffectsManager } from '../../src/render/effects';

// Headless polyfills for requestAnimationFrame
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}

// Mock minimal GameAssets
const mockAssets: any = {
  buildings: {
    house_green: { frame: { width: 96, height: 80 } },
    house_mid: { frame: { width: 96, height: 80 } },
    house_red: { frame: { width: 96, height: 80 } },
    house_blue: { frame: { width: 96, height: 80 } },
    house_purple: { frame: { width: 96, height: 80 } },
    lab: { frame: { width: 112, height: 72 } },
    daycare: { frame: { width: 96, height: 80 } },
    fountain: [{ frame: { width: 40, height: 45 } }],
  },
  trees: {
    tree_round: { frame: { width: 48, height: 64 } },
    tree_narrow: { frame: { width: 48, height: 64 } },
    tree_bush: { frame: { width: 32, height: 32 } },
  },
  groundTiles: {
    lawn: {},
    lawn2: {},
    lawn3: {},
    lawn4: {},
    routegrass: {},
    tallgrass: {},
    forest: {},
    forest2: {},
    forest3: {},
    path: {},
    pave: {},
    pave2: {},
    flower: {},
    sand: {},
    water: {},
    shallow: {},
  },
};

describe('UNIVERSAL SPATIAL & COLLISION CONTRACT Verification Suite', () => {
  let groundLayer: Container;
  let entityLayer: Container;
  let effectsManager: EffectsManager;
  let collisionRegistry: CollisionRegistry;
  let estate: EstateView;

  beforeEach(() => {
    groundLayer = new Container();
    entityLayer = new Container({ sortableChildren: true });
    effectsManager = new EffectsManager();
    collisionRegistry = new CollisionRegistry();

    estate = new EstateView({
      groundLayer,
      entityLayer,
      effectsManager,
      assets: mockAssets,
      collisionRegistry,
    });
  });

  // =========================================================================
  // 1. Self-Declaring Entities
  // =========================================================================
  describe('1. Self-Declaring Entities Law', () => {
    it('automatically registers footprints for all solid scenery and props upon creation', () => {
      const allColliders = collisionRegistry.getColliders(false);
      expect(allColliders.length).toBeGreaterThan(15);

      // Verify cottage registered
      const cottage = allColliders.find((c) => c.label === 'mansion-cottage');
      expect(cottage).toBeDefined();
      expect(cottage!.enabled).toBe(true);

      // Verify hedges registered
      const leftHedge = allColliders.find((c) => c.label === 'hedge-left');
      const rightHedge = allColliders.find((c) => c.label === 'hedge-right');
      expect(leftHedge).toBeDefined();
      expect(rightHedge).toBeDefined();
      expect(leftHedge!.enabled).toBe(true);
      expect(rightHedge!.enabled).toBe(true);

      // Verify Zone 1 trees registered
      const z1Tree0 = allColliders.find((c) => c.label === 'z1-tree-0');
      expect(z1Tree0).toBeDefined();
      expect(z1Tree0!.enabled).toBe(true);

      // Verify locked zone entities registered with enabled = false
      const z2Tree0 = allColliders.find((c) => c.label === 'z2-tree-0');
      expect(z2Tree0).toBeDefined();
      expect(z2Tree0!.enabled).toBe(false);

      const fountain = allColliders.find((c) => c.label === 'fountain');
      expect(fountain).toBeDefined();
      expect(fountain!.enabled).toBe(false);
    });

    it('dynamically activates entity footprints when their zone is unlocked', () => {
      expect(collisionRegistry.isWalkable(20, 300, 8)).toBe(true); // Zone 3 fountain disabled initially

      // Unlock Zone 3
      estate.setUnlockedZones(['zone_01_parlor', 'zone_03_pond_courtyard'], false);

      // Fountain should now be active and block navigation at (20, 300)
      expect(collisionRegistry.isWalkable(20, 300, 8)).toBe(false);

      // Free area nearby should still be walkable
      expect(collisionRegistry.isWalkable(150, 300, 8)).toBe(true);
    });
  });

  // =========================================================================
  // 2. The Ground-Contact Law
  // =========================================================================
  describe('2. The Ground-Contact Law', () => {
    it('anchors all ground-placed entities at (0.5, 1.0)', () => {
      const mainSprite = (estate as any).mansionMainSprite;
      expect(mainSprite.anchor.x).toBe(0.5);
      expect(mainSprite.anchor.y).toBe(1.0);

      // Inspect decor trees
      const decorList = (estate as any).decorSprites;
      for (const item of decorList) {
        expect(item.sprite.anchor.x).toBe(0.5);
        expect(item.sprite.anchor.y).toBe(1.0);
      }
    });

    it('confines collision footprints strictly to the ground-contact area (never canopy or roof)', () => {
      const colliders = collisionRegistry.getColliders(false);

      // Check cottage: height is 160px (y: -160..0), but footprint only covers contact base (minY: -32, maxY: 0)
      const cottage = colliders.find((c) => c.label === 'mansion-cottage')!;
      expect(cottage.minY).toBeGreaterThanOrEqual(-40);
      expect(cottage.maxY).toBeLessThanOrEqual(5);

      // Check trees: canopy reaches up to y - 64, but footprint base only covers y - 8 to y + 2
      const tree = colliders.find((c) => c.label === 'z1-tree-0')!; // at x=-160, y=-20
      expect(tree.minY).toBe(-28); // -20 - 8
      expect(tree.maxY).toBe(-18); // -20 + 2
      // Above trunk (y = -40) is NOT blocked by footprint, allowing walking behind canopy
      expect(tree.minY).toBeGreaterThan(-40);
    });

    it('enforces dynamic depth sorting: zIndex equals integer Y position', () => {
      const mockFrames: any = {
        down: { idle: Texture.EMPTY, walk: [Texture.EMPTY] },
        up: { idle: Texture.EMPTY, walk: [Texture.EMPTY] },
        left: { idle: Texture.EMPTY, walk: [Texture.EMPTY] },
        right: { idle: Texture.EMPTY, walk: [Texture.EMPTY] },
        action: [Texture.EMPTY],
      };

      const maid = new MaidSprite({
        name: 'nyah',
        frames: mockFrames,
        x: 0,
        y: 45,
      });

      expect(maid.zIndex).toBe(45);

      maid.y = -15;
      (maid as any).updateZIndex();
      expect(maid.zIndex).toBe(-15);
    });
  });

  // =========================================================================
  // 3. Closed-Loop Navigation & Wall-Sliding
  // =========================================================================
  describe('3. Closed-Loop Navigation & Wall-Sliding Law', () => {
    it('accurately detects obstacle collisions with body radius', () => {
      // Hedges at x = 40..130, y = 20..44
      expect(collisionRegistry.isWalkable(80, 32, 8)).toBe(false); // inside hedge
      expect(collisionRegistry.isWalkable(80, 0, 8)).toBe(true);   // north of hedge
      expect(collisionRegistry.isWalkable(80, 60, 8)).toBe(true);  // south of hedge
    });

    it('slides cleanly along unobstructed axis when moving obliquely into a wall', () => {
      // Current position: x = 75, y = -15 (just east of cottage at x = -60..60, y = -32..0)
      // Moving left into cottage wall and up: targetX = 55, targetY = -25
      const result = collisionRegistry.tryMove(75, -15, 55, -25, 6);

      // Should detect collision with X obstacle and slide along Y axis
      expect(result.collided).toBe(true);
      expect(result.x).toBe(75); // halted on X
      expect(result.y).toBe(-25); // slid on Y
    });

    it('completely halts movement when both direct path and slide tangents are blocked', () => {
      // Corner blocked test
      const result = collisionRegistry.tryMove(0, 20, 0, -5, 8); // into cottage
      expect(result.collided).toBe(true);
      expect(result.x).toBe(0);
      expect(result.y).toBe(20);
    });
  });
});
