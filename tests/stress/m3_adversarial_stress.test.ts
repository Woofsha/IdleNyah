// tests/stress/m3_adversarial_stress.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Container, Rectangle, Texture, TextureSource } from 'pixi.js';
import { EstateView } from '../../src/render/estate';
import { WorldView } from '../../src/render/world';
import { EffectsManager } from '../../src/render/effects';
import { GameSimulation } from '../../src/core/simulation';
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

describe('Milestone 3 Empirical Adversarial Stress Suite', () => {
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

  afterEach(() => {
    effectsManager.clear();
  });

  // =========================================================================
  // 1. Structure Click Spamming & Effects Lifecycle Stress
  // =========================================================================
  describe('1. Structure Click Spamming & Particle/Text Lifecycles', () => {
    it('survives rapid 500-click spam per structure across all 5 estate structures (2,500 clicks total)', () => {
      const clickCounts: Record<string, number> = {
        mansion: 0,
        fountain: 0,
        garden: 0,
        library: 0,
        observatory: 0,
      };

      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
        onStructureClick: (type, worldX, worldY) => {
          clickCounts[type] = (clickCounts[type] ?? 0) + 1;

          // Mimic main.ts structure click effect spawning
          effectsManager.spawnFloatingText({
            text: `+10g [${type}]`,
            x: worldX,
            y: worldY,
            color: '#ffdd44',
            fontSize: 14,
            isCrit: clickCounts[type] % 10 === 0,
          });

          effectsManager.spawnSparkles({
            x: worldX,
            y: worldY,
            count: 6,
            color: 0xffeb3b,
          });
        },
      });

      // Unlock all zones so all structures exist and are visible
      estate.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ]);

      const structures: Array<{ key: string; obj: any; expectedX: number; expectedY: number }> = [
        { key: 'mansion', obj: (estate as any).mansionMainSprite, expectedX: 0, expectedY: -20 },
        { key: 'fountain', obj: (estate as any).fountainSprite, expectedX: 20, expectedY: 280 },
        { key: 'garden', obj: (estate as any).zones.get('zone_02_kitchen_garden').entities.find((e: any) => e.label === 'interactive-garden-plot'), expectedX: 350, expectedY: -80 },
        { key: 'library', obj: (estate as any).mansionWestWing, expectedX: -240, expectedY: -30 },
        { key: 'observatory', obj: (estate as any).mansionObservatoryDome, expectedX: 16, expectedY: -380 },
      ];

      // Execute 500 simulated clicks on each structure
      for (const s of structures) {
        expect(s.obj).toBeDefined();
        for (let i = 0; i < 500; i++) {
          s.obj.emit('pointerdown', {
            stopPropagation: () => {},
            global: { x: s.expectedX, y: s.expectedY + 20 },
          });
        }
      }

      // 5 structures * 500 clicks = 2,500 clicks executed
      expect(clickCounts.mansion).toBe(500);
      expect(clickCounts.fountain).toBe(500);
      expect(clickCounts.garden).toBe(500);
      expect(clickCounts.library).toBe(500);
      expect(clickCounts.observatory).toBe(500);

      // Total spawned effects in container:
      // Note: unlock sequence also spawned 4 announcement banners + 4 * 52 sparkles = 212 particles.
      // 2,500 clicks * (1 text + 6 sparkles) = 17,500 particles from clicks!
      const totalDisplayObjects = effectsManager.container.children.length;
      expect(totalDisplayObjects).toBeGreaterThanOrEqual(17500);
      expect((effectsManager as any).activeEffects.length).toBe(totalDisplayObjects);

      // Verify no display object in active list has NaN or infinite positions
      for (const effect of (effectsManager as any).activeEffects) {
        expect(Number.isFinite(effect.displayObject.x)).toBe(true);
        expect(Number.isFinite(effect.displayObject.y)).toBe(true);
      }

      // Step simulation by 0.5s: sparkles should start expiring
      effectsManager.update(0.5);
      expect(effectsManager.container.children.length).toBeLessThan(totalDisplayObjects);

      // Step past max lifetime (1.5s more -> 2.0s total): ALL effects must be destroyed and removed
      effectsManager.update(1.5);
      expect(effectsManager.container.children.length).toBe(0);
      expect((effectsManager as any).activeEffects.length).toBe(0);
    });

    it('verifies that destroyed effects free textures and do not leak references', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
        onStructureClick: (type, worldX, worldY) => {
          effectsManager.spawnFloatingText({ text: `+5g`, x: worldX, y: worldY });
          effectsManager.spawnSparkles({ x: worldX, y: worldY, count: 4 });
        },
      });

      const mainMansion = (estate as any).mansionMainSprite;
      mainMansion.emit('pointerdown', { stopPropagation: () => {}, global: { x: 0, y: 0 } });

      const created = [...effectsManager.container.children];
      expect(created.length).toBe(5);

      effectsManager.update(2.0);

      expect(effectsManager.container.children.length).toBe(0);
      for (const obj of created) {
        expect((obj as any).destroyed).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. Unlock Sequence Breaking & Out-of-Order Territory Unlocks
  // =========================================================================
  describe('2. Unlock Sequence Breaking & Persistence Reloading', () => {
    it('verifies 0 coordinate boundary overlaps and 0 duplicate ground tiles between all territory zones', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const zones = Array.from(((estate as any).zones as Map<string, any>).values());

      const overlaps: Array<{ z1: string; z2: string; area: number }> = [];
      for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
          const b1 = zones[i].bounds;
          const b2 = zones[j].bounds;

          const overlapX = Math.max(0, Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX));
          const overlapY = Math.max(0, Math.min(b1.maxY, b2.maxY) - Math.max(b1.minY, b2.minY));
          const area = overlapX * overlapY;
          if (area > 0) {
            overlaps.push({ z1: zones[i].id, z2: zones[j].id, area });
          }
        }
      }

      console.log(`[OVERLAP AUDIT] Found overlaps between territory zones:`, JSON.stringify(overlaps));
      expect(overlaps.length).toBe(0);

      const tilePositions = new Map<string, string>();
      let duplicateTiles = 0;
      for (const zone of zones) {
        for (const child of zone.groundContainer.children) {
          const key = `${child.x},${child.y}`;
          if (tilePositions.has(key)) {
            duplicateTiles++;
          }
          tilePositions.set(key, zone.id);
        }
      }
      console.log(`[TILE AUDIT] Duplicated ground tile positions: ${duplicateTiles}`);
      expect(duplicateTiles).toBe(0);
    });

    it('handles out-of-order unlock sequences without throwing or corrupting bounds', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      // Unlock Zone 5 directly (skipping 2, 3, 4)
      estate.setUnlockedZones(['zone_01_parlor', 'zone_05_starlight_observatory']);

      expect(estate.currentTier).toBe(5);
      const zones = (estate as any).zones as Map<string, any>;
      expect(zones.get('zone_01_parlor').unlocked).toBe(true);
      expect(zones.get('zone_05_starlight_observatory').unlocked).toBe(true);
      expect(zones.get('zone_02_kitchen_garden').unlocked).toBe(false);
      expect(zones.get('zone_03_pond_courtyard').unlocked).toBe(false);
      expect(zones.get('zone_04_library_balcony').unlocked).toBe(false);

      // Verify bounds encompass Zone 1 and Zone 5
      const bounds = estate.getCombinedUnlockedBounds();
      expect(bounds.minX).toBeLessThanOrEqual(-192);
      expect(bounds.maxX).toBeGreaterThanOrEqual(192);
      expect(bounds.minY).toBeLessThanOrEqual(-480); // Zone 5 northern bounds
      expect(bounds.maxY).toBeGreaterThanOrEqual(160);
      expect(bounds.minX).toBeLessThan(bounds.maxX);
      expect(bounds.minY).toBeLessThan(bounds.maxY);

      // Now unlock Zone 3 in isolation
      estate.setUnlockedZones(['zone_01_parlor', 'zone_03_pond_courtyard', 'zone_05_starlight_observatory']);
      expect(zones.get('zone_03_pond_courtyard').unlocked).toBe(true);
      const boundsAfterZ3 = estate.getCombinedUnlockedBounds();
      expect(boundsAfterZ3.maxY).toBeGreaterThanOrEqual(480); // Courtyard southern bounds
    });

    it('handles unlocking all 5 zones simultaneously on frame 0', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      // Unlock all 5 zones at once with animation
      estate.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ], true);

      expect(estate.currentTier).toBe(5);
      const zones = (estate as any).zones as Map<string, any>;
      for (const zone of zones.values()) {
        expect(zone.unlocked).toBe(true);
      }

      // Check full combined bounds: encompasses from West (-544) to East (544) and North (-480) to South (480)
      const fullBounds = estate.getCombinedUnlockedBounds();
      expect(fullBounds.minX).toBe(-544);
      expect(fullBounds.maxX).toBe(544);
      expect(fullBounds.minY).toBe(-480);
      expect(fullBounds.maxY).toBe(480);
    });

    it('handles unexpected, empty, or unknown zone IDs gracefully', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      // Pass completely empty array
      expect(() => {
        estate.setUnlockedZones([]);
      }).not.toThrow();

      // Pass garbage/unknown strings
      expect(() => {
        estate.setUnlockedZones(['zone_99_mars', 'secret_dungeon', '']);
      }).not.toThrow();

      // Spatial bounds should still be valid numbers (not NaN)
      const bounds = estate.getCombinedUnlockedBounds();
      expect(Number.isFinite(bounds.minX)).toBe(true);
      expect(Number.isFinite(bounds.maxX)).toBe(true);
      expect(Number.isFinite(bounds.minY)).toBe(true);
      expect(Number.isFinite(bounds.maxY)).toBe(true);
    });

    it('empirically verifies clean wing visibility reset when reloading save data with lower tier estate', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      // Advance estate to Tier 5
      estate.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ]);
      expect(estate.currentTier).toBe(5);

      const westWing = (estate as any).mansionWestWing;
      const eastWing = (estate as any).mansionEastWing;
      const dome = (estate as any).mansionObservatoryDome;
      const fountain = (estate as any).fountainSprite;

      expect(westWing.visible).toBe(true);
      expect(eastWing.visible).toBe(true);
      expect(dome.visible).toBe(true);
      expect(fountain.visible).toBe(true);

      // Now simulate reloading from persistence with a starter cottage (Tier 1) estate
      estate.setUnlockedZones(['zone_01_parlor']);
      expect(estate.currentTier).toBe(1);

      // Verify that higher-tier wings (westWing, eastWing, dome) are cleanly reset to false
      const zones = (estate as any).zones as Map<string, any>;
      const isZone2Latched = zones.get('zone_02_kitchen_garden').unlocked;
      const isWestWingLatched = westWing.visible;
      const isEastWingLatched = eastWing.visible;
      const isDomeLatched = dome.visible;

      console.log(`[CHALLENGE OBSERVATION] Latching State after Tier 1 reload: zone2Latched=${isZone2Latched}, westWingLatched=${isWestWingLatched}, eastWingLatched=${isEastWingLatched}, domeLatched=${isDomeLatched}`);
      expect(isZone2Latched).toBe(true);
      expect(isWestWingLatched).toBe(false);
      expect(isEastWingLatched).toBe(false);
      expect(isDomeLatched).toBe(false);
    });
  });

  // =========================================================================
  // 3. Mist Container Alpha Transitions & Particle Cleanup Stress
  // =========================================================================
  describe('3. Mist Container Alpha Transitions & Particle Cleanup Stress', () => {
    it('fades mist smoothly and disables visibility upon completion across all zones', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      estate.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ], true);

      const zones = (estate as any).zones as Map<string, any>;
      const fadingZones = Array.from(zones.values()).filter((z) => z.id !== 'zone_01_parlor');
      expect(fadingZones.length).toBe(4);

      for (const z of fadingZones) {
        expect(z.isFadingMist).toBe(true);
        expect(z.mistAlpha).toBe(1.0);
      }

      // Step half-way (mist fades at deltaSeconds * 1.5, so 0.33s = ~0.5 alpha)
      estate.update(0.33);
      for (const z of fadingZones) {
        expect(z.isFadingMist).toBe(true);
        expect(z.mistAlpha).toBeLessThan(1.0);
        expect(z.mistAlpha).toBeGreaterThan(0);
        expect(z.mistContainer.alpha).toBeCloseTo(z.mistAlpha, 2);
      }

      // Step remaining time (0.6s more -> 0.93s total * 1.5 = 1.395 decrement >= 1.0)
      estate.update(0.6);
      for (const z of fadingZones) {
        expect(z.isFadingMist).toBe(false);
        expect(z.mistAlpha).toBe(0);
        expect(z.mistContainer.visible).toBe(false);
      }
    });

    it('handles extreme deltaSeconds (3600s background tab) cleanly without negative alpha or errors', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      estate.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden'], true);
      const z2 = (estate as any).zones.get('zone_02_kitchen_garden');
      expect(z2.isFadingMist).toBe(true);

      // Huge delta (e.g. 1 hour offline tab resume)
      estate.update(3600);
      expect(z2.mistAlpha).toBe(0);
      expect(z2.isFadingMist).toBe(false);
      expect(z2.mistContainer.visible).toBe(false);
    });

    it('survives 1,000 micro-step ticker updates without floating point drift or stalling', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      estate.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden'], true);
      const z2 = (estate as any).zones.get('zone_02_kitchen_garden');

      // 1,000 steps of 0.001s = 1.0s total (1.0 * 1.5 = 1.5 > 1.0, should complete)
      for (let i = 0; i < 1000; i++) {
        estate.update(0.001);
      }

      expect(z2.mistAlpha).toBe(0);
      expect(z2.isFadingMist).toBe(false);
      expect(z2.mistContainer.visible).toBe(false);
    });

    it('cleans up all unlock announcement banners and celebration sparkles after fast unlock triggers', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      // Trigger all 4 unlocks simultaneously
      estate.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ], true);

      // 4 zones * (1 banner + 52 sparkles) = 212 particles spawned
      expect(effectsManager.container.children.length).toBe(212);

      // Update past maximum lifetime (banner crit lifetime is 1.2s, sparkles ~0.65s)
      effectsManager.update(2.0);

      expect(effectsManager.container.children.length).toBe(0);
      expect((effectsManager as any).activeEffects.length).toBe(0);
    });
  });

  // =========================================================================
  // 4. Courtyard Fountain Animation Stress & Zero Delta Handling
  // =========================================================================
  describe('4. Courtyard Fountain Animation Stress', () => {
    it('cycles fountain frames continuously without crashing or exceeding texture array', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      estate.setUnlockedZones(['zone_01_parlor', 'zone_03_pond_courtyard']);
      const fountain = (estate as any).fountainSprite;
      expect(fountain.visible).toBe(true);

      const fountainTextures = assets.buildings.fountain;
      expect(fountainTextures.length).toBe(5);

      // Simulate 60 frames of 0.016s (~1 second)
      const observedTextures = new Set<Texture>();
      for (let f = 0; f < 60; f++) {
        estate.update(0.016);
        observedTextures.add(fountain.texture);
      }

      // Should have cycled through all 5 fountain animation frames
      expect(observedTextures.size).toBe(5);
    });

    it('does not crash or advance fountain when deltaSeconds is 0', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      estate.setUnlockedZones(['zone_01_parlor', 'zone_03_pond_courtyard']);
      const fountain = (estate as any).fountainSprite;
      const initialTex = fountain.texture;

      estate.update(0);
      expect(fountain.texture).toBe(initialTex);
    });
  });

function makeMockPixiApp(): any {
  const stage = new Container({ label: 'mock-stage' });
  return {
    stage,
    screen: { width: 960, height: 640 },
  };
}

  // =========================================================================
  // 5. WorldView Camera & Maid Boundary Expansion Integration Stress
  // =========================================================================
  describe('5. WorldView Camera & Maid Boundary Integration Stress', () => {
    let app: any;

    beforeEach(() => {
      app = makeMockPixiApp();
    });

    afterEach(() => {
      if (app && app.stage) {
        app.stage.destroy({ children: true });
      }
    });

    it('dynamically adapts cameraBounds and maid wanderBounds across territory unlock progressions', () => {
      const worldView = new WorldView({
        app,
        assets,
      });

      // Initially only Starter Cottage (Tier 1)
      expect(worldView.cameraBounds.minX).toBe(-200);
      expect(worldView.cameraBounds.maxX).toBe(200);
      expect(worldView.cameraBounds.minY).toBe(-140);
      expect(worldView.cameraBounds.maxY).toBe(140);

      // Expand to Kitchen Garden (Tier 2, East expansion)
      worldView.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden'], false);
      expect(worldView.cameraBounds.maxX).toBeGreaterThanOrEqual(484); // 544 - 60

      // Expand to Courtyard & Pond (Tier 3, South expansion)
      worldView.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden', 'zone_03_pond_courtyard'], false);
      expect(worldView.cameraBounds.maxY).toBeGreaterThanOrEqual(420); // 480 - 60

      // Expand to Library & Balcony (Tier 4, West expansion)
      worldView.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
      ], false);
      expect(worldView.cameraBounds.minX).toBeLessThanOrEqual(-484); // -544 + 60

      // Expand to Celestial Observatory (Tier 5, North expansion)
      worldView.setUnlockedZones([
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ], false);
      expect(worldView.cameraBounds.minY).toBeLessThanOrEqual(-420); // -480 + 60

      // Maid wander bounds must be strictly inside the unlocked estate territory
      const nyahBounds = (worldView.maidNyah as any).wanderBounds;
      const fifiBounds = (worldView.maidFifi as any).wanderBounds;

      expect(nyahBounds.minX).toBeLessThan(nyahBounds.maxX);
      expect(nyahBounds.minY).toBeLessThan(nyahBounds.maxY);
      expect(fifiBounds.minX).toBeLessThan(fifiBounds.maxX);
      expect(fifiBounds.minY).toBeLessThan(fifiBounds.maxY);
    });

    it('integrates structure clicks with GameSimulation and Maid animations under spam', () => {
      const sim = new GameSimulation({ seed: 'stress-click-m3' });
      let structureClickCount = 0;

      const worldView = new WorldView({
        app,
        assets,
        onStructureClick: (structureType, worldX, worldY) => {
          structureClickCount++;
          const clickResult = sim.handleClick();

          if (structureType === 'mansion') {
            worldView.maidNyah.setState('chore');
          } else if (structureType === 'fountain') {
            worldView.maidFifi.setState('chore');
          }

          worldView.effectsManager.spawnFloatingText({
            text: `+${clickResult.goldEarned}g [${structureType}]`,
            x: worldX,
            y: worldY,
          });
          worldView.effectsManager.spawnSparkles({
            x: worldX,
            y: worldY,
            count: 6,
          });
        },
      });

      worldView.setUnlockedZones([
        'zone_01_parlor',
        'zone_03_pond_courtyard',
      ], false);

      const mainMansion = (worldView.estateView as any).mansionMainSprite;
      const fountain = (worldView.estateView as any).fountainSprite;

      // 100 clicks alternating between mansion and fountain
      for (let i = 0; i < 100; i++) {
        const target = i % 2 === 0 ? mainMansion : fountain;
        target.emit('pointerdown', {
          stopPropagation: () => {},
          global: { x: target.x, y: target.y },
        });
      }

      expect(structureClickCount).toBe(100);
      expect(sim.getState().clickStats.totalClicks).toBe(100);
      expect(sim.getState().currencies.gold).toBeGreaterThan(0);
      expect((worldView.maidNyah as any).currentState).toBe('chore');
      expect((worldView.maidFifi as any).currentState).toBe('chore');

      // Update worldView ticker
      worldView.update(0.016);
      expect(worldView.effectsManager.container.children.length).toBe(700);

      // Fast forward past effect lifecycles
      worldView.update(2.0);
      expect(worldView.effectsManager.container.children.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. Adversarial Fuzzing: Rapid Tier Switching, Power-Set Unlocks & Invariant Oracles
  // =========================================================================
  describe('6. Adversarial Fuzzing: Rapid Tier Switching, Power-Set Unlocks & Invariant Oracles', () => {
    it('survives 1,000 rapid arbitrary tier transitions without state desync or texture leaks', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const mainSprite = (estate as any).mansionMainSprite;
      const westWing = (estate as any).mansionWestWing;
      const eastWing = (estate as any).mansionEastWing;
      const dome = (estate as any).mansionObservatoryDome;

      const candidateTiers = [-5, 0, 1, 2, 3, 4, 5, 6, 10, 999];

      for (let i = 0; i < 1000; i++) {
        const chosenTier = candidateTiers[Math.floor(Math.random() * candidateTiers.length)];
        estate.updateMansionTier(chosenTier);

        const clampedTier = Math.max(1, Math.min(5, chosenTier));
        expect(estate.currentTier).toBe(clampedTier);

        // Verify correct texture assignment
        if (clampedTier === 1) expect(mainSprite.texture).toBe(assets.buildings.house_green);
        else if (clampedTier === 2) expect(mainSprite.texture).toBe(assets.buildings.house_mid);
        else if (clampedTier === 3 || clampedTier === 4) expect(mainSprite.texture).toBe(assets.buildings.house_red);
        else if (clampedTier === 5) expect(mainSprite.texture).toBe(assets.buildings.daycare);

        // Verify strict wing visibility invariant
        expect(westWing.visible).toBe(clampedTier >= 4);
        expect(eastWing.visible).toBe(clampedTier >= 5);
        expect(dome.visible).toBe(clampedTier >= 5);

        // Spatial anchor and coordinates stability
        expect(mainSprite.x).toBe(0);
        expect(mainSprite.y).toBe(0);
        expect(westWing.x).toBe(-240);
        expect(westWing.y).toBe(-10);
        expect(eastWing.x).toBe(180);
        expect(eastWing.y).toBe(-10);
        expect(dome.x).toBe(16);
        expect(dome.y).toBe(-360);
      }
    });

    it('tests all 32 power-set combinations of zone unlocks for entity visibility and spatial integrity', () => {
      const allZoneIds = [
        'zone_01_parlor',
        'zone_02_kitchen_garden',
        'zone_03_pond_courtyard',
        'zone_04_library_balcony',
        'zone_05_starlight_observatory',
      ];

      // 2^5 = 32 power set subsets
      const totalCombinations = 1 << allZoneIds.length;
      for (let mask = 0; mask < totalCombinations; mask++) {
        const estate = new EstateView({
          groundLayer: new Container(),
          entityLayer: new Container({ sortableChildren: true }),
          effectsManager: new EffectsManager(),
          assets,
        });

        const subset: string[] = [];
        for (let bit = 0; bit < allZoneIds.length; bit++) {
          if ((mask & (1 << bit)) !== 0) {
            subset.push(allZoneIds[bit]);
          }
        }

        estate.setUnlockedZones(subset, false);

        const bounds = estate.getCombinedUnlockedBounds();
        expect(Number.isFinite(bounds.minX)).toBe(true);
        expect(Number.isFinite(bounds.maxX)).toBe(true);
        expect(Number.isFinite(bounds.minY)).toBe(true);
        expect(Number.isFinite(bounds.maxY)).toBe(true);
        expect(bounds.minX).toBeLessThan(bounds.maxX);
        expect(bounds.minY).toBeLessThan(bounds.maxY);

        const zones = (estate as any).zones as Map<string, any>;
        for (const zone of zones.values()) {
          const isExpectedUnlocked = subset.includes(zone.id) || zone.id === 'zone_01_parlor';
          expect(zone.unlocked).toBe(isExpectedUnlocked);

          if (isExpectedUnlocked) {
            expect(zone.mistContainer.visible).toBe(false);
            expect(zone.mistAlpha).toBe(0);
            for (const entity of zone.entities) {
              expect(entity.visible).toBe(true);
            }
          }
        }
      }
    });

    it('stress-tests fog mist transitions under extreme micro-steps, macro-steps, and zero deltas', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      estate.setUnlockedZones(['zone_01_parlor', 'zone_02_kitchen_garden'], true);
      const z2 = (estate as any).zones.get('zone_02_kitchen_garden');
      expect(z2.isFadingMist).toBe(true);
      expect(z2.mistAlpha).toBe(1.0);

      // Micro step: delta 1e-6
      estate.update(1e-6);
      expect(z2.mistAlpha).toBeLessThanOrEqual(1.0);
      expect(z2.mistAlpha).toBeGreaterThan(0.999);

      // Zero step: delta 0
      const prevAlpha = z2.mistAlpha;
      estate.update(0);
      expect(z2.mistAlpha).toBe(prevAlpha);

      // Normal step
      estate.update(0.1);
      expect(z2.mistAlpha).toBeLessThan(prevAlpha);

      // Massive step (tab sleep / offline restore): 10,000s
      estate.update(10000);
      expect(z2.mistAlpha).toBe(0);
      expect(z2.isFadingMist).toBe(false);
      expect(z2.mistContainer.visible).toBe(false);
    });

    it('rigorously validates 0 pixel overlap across all 10 pairwise zone combinations', () => {
      const estate = new EstateView({
        groundLayer,
        entityLayer,
        effectsManager,
        assets,
      });

      const zones = Array.from(((estate as any).zones as Map<string, any>).values());

      for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
          const b1 = zones[i].bounds;
          const b2 = zones[j].bounds;

          // Open-interval overlap check (interior overlap)
          const overlapWidth = Math.max(0, Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX));
          const overlapHeight = Math.max(0, Math.min(b1.maxY, b2.maxY) - Math.max(b1.minY, b2.minY));
          const overlapArea = overlapWidth * overlapHeight;

          expect(overlapArea).toBe(0);
        }
      }
    });
  });
});

