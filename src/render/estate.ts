// src/render/estate.ts
import { Container, Sprite, AnimatedSprite, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import type { GameAssets } from './assets';
import type { EffectsManager } from './effects';
import { getBespokeEstateAssets, type BespokeEstateAssets } from './bespokeAssets';
import { CollisionRegistry, type WorldCollider } from './collisionRegistry';

export interface EstateViewOptions {
  groundLayer: Container;
  entityLayer: Container;
  effectsManager: EffectsManager;
  assets: GameAssets;
  collisionRegistry?: CollisionRegistry;
  onStructureClick?: (structureType: string, worldX: number, worldY: number) => void;
}

export interface ZoneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ZoneVisuals {
  id: string;
  name: string;
  tier: number;
  groundContainer: Container;
  mistContainer: Container;
  entities: Container[];
  bounds: ZoneBounds;
  unlocked: boolean;
  mistAlpha: number;
  isFadingMist: boolean;
}

/**
 * Manages rendering of the evolving mansion (Tiers 1-5), the 5 outdoor territory zones,
 * ground terrain tiles, decor, mist covers, unlock reveal animations, and interactive structure clicking.
 */
export class EstateView {
  public readonly groundLayer: Container;
  public readonly entityLayer: Container;
  public readonly effectsManager: EffectsManager;
  public readonly assets: GameAssets;
  public readonly bespoke: BespokeEstateAssets;
  public readonly collisionRegistry: CollisionRegistry;

  private onStructureClickCallback?: (structureType: string, worldX: number, worldY: number) => void;

  // Mansion structure sprites & containers
  public currentTier = 1;
  public unlockedZoneIds = new Set<string>(['zone_01_parlor']);
  private mansionContainer: Container;
  private mansionMainSprite: Sprite;
  private mansionWestWing?: Sprite;
  private mansionEastWing?: Sprite;
  private mansionObservatoryDome?: Sprite;

  // Courtyard animated fountain
  private fountainSprite?: AnimatedSprite;
  private fountainAnimTimer = 0;
  private fountainFrameIndex = 0;

  // Zone visuals map
  private zones = new Map<string, ZoneVisuals>();

  // In-game wind sway and ambient fireflies
  public windSwayEnabled = true;
  public firefliesEnabled = true;
  private windTimer = 0;
  private decorSprites: Array<{ sprite: Sprite; baseX: number; phase: number; isBush: boolean }> = [];
  private firefliesContainer!: Container;
  public volumetricLightContainer!: Container;
  private fireflyData: Array<{ x: number; y: number; baseX: number; vY: number; phase: number; sprite: Graphics }> = [];

  constructor(options: EstateViewOptions) {
    this.groundLayer = options.groundLayer;
    this.entityLayer = options.entityLayer;
    this.effectsManager = options.effectsManager;
    this.assets = options.assets;
    this.bespoke = getBespokeEstateAssets();
    this.collisionRegistry = options.collisionRegistry ?? new CollisionRegistry();
    this.onStructureClickCallback = options.onStructureClick;

    // Mansion container in entity layer
    this.mansionContainer = new Container({
      label: 'mansion-container',
    });
    this.entityLayer.addChild(this.mansionContainer);

    // Ground contact shadow under cottage (anchoring structure into 2.5D space)
    const mansionShadow = new Graphics();
    mansionShadow.ellipse(-12, 6, 84, 18);
    mansionShadow.fill({ color: 0x141024, alpha: 0.52 });
    this.mansionContainer.addChild(mansionShadow);

    // Initial bespoke cottage for starter mansion
    this.mansionMainSprite = new Sprite({
      texture: this.bespoke.cottage,
      scale: 2,
      anchor: { x: 0.5, y: 1.0 },
      x: 0,
      y: 0,
      roundPixels: true,
      label: 'mansion-main',
    });
    this.setupInteractiveStructure(this.mansionMainSprite, 'mansion');
    this.mansionContainer.addChild(this.mansionMainSprite);

    // Self-Declaring Entity: register cottage ground contact footprint
    // Ground-Contact Law: covers strictly the soil contact base (minY: -32 to 0)
    this.collisionRegistry.register({
      id: 'collider-mansion-cottage',
      label: 'mansion-cottage',
      minX: -60,
      maxX: 60,
      minY: -32,
      maxY: 0,
      zoneId: 'zone_01_parlor',
      enabled: true,
    });

    // Build all 5 zones (ground, decor, mist overlays)
    this.initZones();

    // Initialize in-game ambient fireflies
    this.initFireflies();

    // Initialize warm golden hour volumetric sun shafts
    this.initVolumetricLight();

    // Initial tier 1 update
    this.updateMansionTier(1);
  }

  /**
   * Sets up interactive click detection on a building or outdoor structure.
   */
  private setupInteractiveStructure(target: Container, structureType: string): void {
    target.eventMode = 'static';
    target.cursor = 'pointer';

    target.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this.onStructureClickCallback) {
        const localPos = target.parent ? target.parent.toLocal(e.global) : target.toLocal(e.global);
        const worldX = Math.round(target.x);
        const worldY = Math.round(target.y - 20);
        this.onStructureClickCallback(structureType, worldX, worldY);
      }
    });
  }

  /**
   * Initializes all 5 outdoor territory zones with terrain blocks, vegetation, decor, and mist covers.
   */
  private initZones(): void {
    this.buildZone1Parlor();
    this.buildZone2KitchenGarden();
    this.buildZone3CourtyardPond();
    this.buildZone4LibraryBalcony();
    this.buildZone5StarlightObservatory();
  }

  /**
   * Helper to place a 32x32 ground tile in a zone's ground container.
   */
  private addGroundTile(
    container: Container,
    tileName: keyof GameAssets['groundTiles'],
    tileX: number,
    tileY: number
  ): void {
    const texture = this.assets.groundTiles[tileName] ?? this.assets.groundTiles.lawn;
    const sprite = new Sprite({
      texture,
      x: tileX * 32,
      y: tileY * 32,
      roundPixels: true,
    });
    container.addChild(sprite);
  }

  /**
   * Helper to place a custom texture in a zone's ground container.
   */
  private addCustomTile(container: Container, texture: any, tileX: number, tileY: number): void {
    const sprite = new Sprite({
      texture,
      x: tileX * 32,
      y: tileY * 32,
      roundPixels: true,
    });
    container.addChild(sprite);
  }

  /**
   * Helper to create a decorative tree or bush in a zone.
   * Self-Declaring Entity: automatically registers ground-contact footprint in CollisionRegistry.
   */
  private createTree(
    type: 'tree_round' | 'tree_narrow' | 'tree_bush',
    x: number,
    y: number,
    label: string,
    zoneId = 'zone_01_parlor',
    enabled = true
  ): Sprite {
    const tex = type === 'tree_bush' ? this.bespoke.bush : this.bespoke.tree;

    const sprite = new Sprite({
      texture: tex,
      scale: 1,
      anchor: { x: 0.5, y: 1.0 },
      x,
      y,
      roundPixels: true,
      label,
    });
    sprite.zIndex = Math.floor(y);
    this.decorSprites.push({
      sprite,
      baseX: x,
      phase: ((x * 0.13 + y * 0.27) % 6.28 + 6.28) % 6.28,
      isBush: type === 'tree_bush',
    });

    // Self-Declaring Entity & Ground-Contact Law:
    // Collision footprint strictly covers the ground contact base where trunk/stem touches soil
    const halfW = type === 'tree_bush' ? 12 : 10;
    this.collisionRegistry.register({
      id: `collider-${label}`,
      label,
      minX: x - halfW,
      maxX: x + halfW,
      minY: y - 8,
      maxY: y + 2,
      zoneId,
      enabled,
    });

    return sprite;
  }

  /**
   * Creates a semi-transparent mist overlay cover for a locked zone.
   */
  private createMistOverlay(bounds: ZoneBounds, zoneName: string): Container {
    const mist = new Container({ label: `mist-${zoneName}` });

    const g = new Graphics();
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;

    // Soft mystical mist rectangle
    g.rect(bounds.minX, bounds.minY, w, h);
    g.fill({ color: 0x181528, alpha: 0.72 });
    g.stroke({ color: 0x3d355b, width: 2, alpha: 0.85 });

    // Decorative clouds / mist swirls
    const swirlCount = Math.max(3, Math.floor(w / 100));
    for (let i = 0; i < swirlCount; i++) {
      const cx = bounds.minX + 40 + (i * (w - 80)) / (swirlCount - 1);
      const cy = bounds.minY + 30 + ((i % 2) * (h - 60)) / 2;
      g.ellipse(cx, cy, 36, 18);
      g.fill({ color: 0x2e2948, alpha: 0.35 });
    }

    mist.addChild(g);

    // Subtle retro lock label in the center of the mist
    const labelStyle = new TextStyle({
      fontFamily: 'Courier New, monospace',
      fontSize: 13,
      fontWeight: 'bold',
      fill: '#a97bff',
      dropShadow: {
        alpha: 0.8,
        angle: Math.PI / 6,
        blur: 2,
        color: '#0a0914',
        distance: 2,
      },
    });

    const label = new Text({
      text: `[Territory Locked: ${zoneName}]`,
      style: labelStyle,
      anchor: { x: 0.5, y: 0.5 },
      x: bounds.minX + w / 2,
      y: bounds.minY + h / 2,
    });
    mist.addChild(label);

    return mist;
  }

  // =========================================================================
  // Zone 1: Starter Parlor & Porch
  // =========================================================================
  private buildZone1Parlor(): void {
    const ground = new Container({ label: 'zone_01_ground' });
    this.groundLayer.addChild(ground);

    const bounds: ZoneBounds = { minX: -192, maxX: 192, minY: -160, maxY: 160 };

    // Fill 12 cols (-6..5) x 10 rows (-5..4)
    for (let col = -6; col < 6; col++) {
      for (let row = -5; row < 5; row++) {
        const isCenterPath = (col === -1 || col === 0) && row >= 0 && row <= 4;
        const isPorchWalk = row === 0 && col >= -2 && col <= 1;
        const isHedge = (col >= -4 && col <= -2 && row === 1) || (col >= 1 && col <= 3 && row === 1);

        if (isCenterPath) {
          this.addCustomTile(ground, this.bespoke.path, col, row);
        } else if (isPorchWalk) {
          this.addCustomTile(ground, this.bespoke.porchWood, col, row);
        } else if (isHedge) {
          this.addCustomTile(ground, this.bespoke.hedge, col, row);
        } else if ((col === -3 && row === 2) || (col === 2 && row === 2) || (col === -4 && row === 4) || (col === 3 && row === 4)) {
          this.addCustomTile(ground, this.bespoke.lawnFlowers, col, row);
        } else {
          this.addCustomTile(ground, this.bespoke.lawn, col, row);
        }
      }
    }

    // Decor trees
    const entities: Container[] = [];
    const treeDefs: Array<{ type: 'tree_round' | 'tree_narrow' | 'tree_bush'; x: number; y: number }> = [
      { type: 'tree_round', x: -160, y: -20 },
      { type: 'tree_round', x: 160, y: -20 },
      { type: 'tree_narrow', x: -140, y: -90 },
      { type: 'tree_narrow', x: 140, y: -90 },
      { type: 'tree_bush', x: -100, y: 100 },
      { type: 'tree_bush', x: 100, y: 100 },
      { type: 'tree_bush', x: -40, y: 130 },
      { type: 'tree_bush', x: 40, y: 130 },
    ];

    treeDefs.forEach((def, i) => {
      const tree = this.createTree(def.type, def.x, def.y, `z1-tree-${i}`, 'zone_01_parlor', true);
      this.entityLayer.addChild(tree);
      entities.push(tree);
    });

    // Self-Declaring Entity: register Zone 1 hedges
    this.collisionRegistry.register({
      id: 'collider-hedge-left',
      label: 'hedge-left',
      minX: -130,
      maxX: -40,
      minY: 20,
      maxY: 44,
      zoneId: 'zone_01_parlor',
      enabled: true,
    });
    this.collisionRegistry.register({
      id: 'collider-hedge-right',
      label: 'hedge-right',
      minX: 40,
      maxX: 130,
      minY: 20,
      maxY: 44,
      zoneId: 'zone_01_parlor',
      enabled: true,
    });

    // Zone 1 is unlocked from the start (no mist)
    const mist = new Container({ visible: false });
    this.groundLayer.addChild(mist);

    this.zones.set('zone_01_parlor', {
      id: 'zone_01_parlor',
      name: 'Starter Cottage & Porch',
      tier: 1,
      groundContainer: ground,
      mistContainer: mist,
      entities,
      bounds,
      unlocked: true,
      mistAlpha: 0,
      isFadingMist: false,
    });
  }

  // =========================================================================
  // Zone 2: Kitchen Gardens & Herb Beds
  // =========================================================================
  private buildZone2KitchenGarden(): void {
    const ground = new Container({ label: 'zone_02_ground' });
    this.groundLayer.addChild(ground);

    const bounds: ZoneBounds = { minX: 192, maxX: 544, minY: -160, maxY: 160 };

    // Fill 11 cols (6..16) x 10 rows (-5..4)
    for (let col = 6; col < 17; col++) {
      for (let row = -5; row < 5; row++) {
        const isPath = row === 1 && col >= 6 && col <= 11;
        const isVegetableBed = col >= 8 && col <= 14 && (row === -3 || row === -2 || row === -1);
        const isHerbBed = col >= 8 && col <= 14 && (row === 2 || row === 3 || row === 4);

        if (isPath) {
          this.addGroundTile(ground, 'path', col, row);
        } else if (isVegetableBed) {
          // Alternating tilled soil and garden greens
          if (row === -2) {
            this.addGroundTile(ground, 'sand', col, row);
          } else if (col % 2 === 0) {
            this.addGroundTile(ground, 'flower', col, row);
          } else {
            this.addGroundTile(ground, 'routegrass', col, row);
          }
        } else if (isHerbBed) {
          if (col % 3 === 0) {
            this.addGroundTile(ground, 'flower', col, row);
          } else if (row === 3) {
            this.addGroundTile(ground, 'sand', col, row);
          } else {
            this.addGroundTile(ground, 'lawn2', col, row);
          }
        } else if (col >= 15) {
          this.addGroundTile(ground, 'forest', col, row);
        } else {
          this.addGroundTile(ground, 'lawn', col, row);
        }
      }
    }

    const entities: Container[] = [];

    // Fruit orchard trees & garden bushes
    const treeDefs: Array<{ type: 'tree_round' | 'tree_narrow' | 'tree_bush'; x: number; y: number }> = [
      { type: 'tree_round', x: 460, y: -40 },
      { type: 'tree_round', x: 460, y: 80 },
      { type: 'tree_round', x: 320, y: -100 },
      { type: 'tree_narrow', x: 490, y: 20 },
      { type: 'tree_bush', x: 260, y: 40 },
      { type: 'tree_bush', x: 400, y: 40 },
      { type: 'tree_bush', x: 260, y: 140 },
      { type: 'tree_bush', x: 400, y: 140 },
    ];

    treeDefs.forEach((def, i) => {
      const tree = this.createTree(def.type, def.x, def.y, `z2-tree-${i}`, 'zone_02_kitchen_garden', false);
      tree.visible = false;
      this.entityLayer.addChild(tree);
      entities.push(tree);
    });

    // Interactive garden plot sprite / marker
    const gardenMarker = new Sprite({
      texture: this.assets.groundTiles.flower,
      scale: 2,
      anchor: { x: 0.5, y: 1.0 },
      x: 350,
      y: -60,
      roundPixels: true,
      label: 'interactive-garden-plot',
    });
    gardenMarker.zIndex = -60;
    gardenMarker.visible = false;
    this.setupInteractiveStructure(gardenMarker, 'garden');
    this.entityLayer.addChild(gardenMarker);
    entities.push(gardenMarker);

    // Self-Declaring Entity: register garden plot footprint
    this.collisionRegistry.register({
      id: 'collider-interactive-garden-plot',
      label: 'interactive-garden-plot',
      minX: 330,
      maxX: 370,
      minY: -72,
      maxY: -56,
      zoneId: 'zone_02_kitchen_garden',
      enabled: false,
    });

    // Mist cover
    const mist = this.createMistOverlay(bounds, 'Kitchen Gardens');
    this.groundLayer.addChild(mist);

    this.zones.set('zone_02_kitchen_garden', {
      id: 'zone_02_kitchen_garden',
      name: 'Country Kitchen Gardens',
      tier: 2,
      groundContainer: ground,
      mistContainer: mist,
      entities,
      bounds,
      unlocked: false,
      mistAlpha: 1.0,
      isFadingMist: false,
    });
  }

  // =========================================================================
  // Zone 3: Cobblestone Courtyard & Whispering Pond
  // =========================================================================
  private buildZone3CourtyardPond(): void {
    const ground = new Container({ label: 'zone_03_ground' });
    this.groundLayer.addChild(ground);

    const bounds: ZoneBounds = { minX: -352, maxX: 224, minY: 160, maxY: 480 };

    // Fill 18 cols (-11..6) x 10 rows (5..14)
    for (let col = -11; col < 7; col++) {
      for (let row = 5; row < 15; row++) {
        const isCourtyard = col >= -4 && col <= 5 && row >= 5 && row <= 13;
        const isPondWater = col >= -10 && col <= -6 && row >= 7 && row <= 11;
        const isPondShore = col >= -11 && col <= -5 && row >= 6 && row <= 12;

        if (isCourtyard) {
          // Cobblestone paving
          if (row === 5 || row === 13 || col === -4 || col === 5) {
            this.addGroundTile(ground, 'pave2', col, row);
          } else {
            this.addGroundTile(ground, 'pave', col, row);
          }
        } else if (isPondWater) {
          this.addGroundTile(ground, 'water', col, row);
        } else if (isPondShore) {
          if (col === -5 && row === 9) {
            this.addGroundTile(ground, 'pave2', col, row); // viewing deck pier
          } else {
            this.addGroundTile(ground, 'shallow', col, row);
          }
        } else if (col === -5 && (row === 8 || row === 10)) {
          this.addGroundTile(ground, 'flower', col, row);
        } else {
          this.addGroundTile(ground, 'lawn', col, row);
        }
      }
    }

    const entities: Container[] = [];

    // Animated Fountain (40x45 at 2x = 80x90 px) in courtyard center
    this.fountainSprite = new AnimatedSprite(this.assets.buildings.fountain);
    this.fountainSprite.anchor.set(0.5, 1.0);
    this.fountainSprite.scale.set(2);
    this.fountainSprite.x = 20;
    this.fountainSprite.y = 300;
    this.fountainSprite.zIndex = 300;
    this.fountainSprite.animationSpeed = 0.12;
    this.fountainSprite.roundPixels = true;
    this.fountainSprite.label = 'courtyard-fountain';
    this.fountainSprite.visible = false;
    this.setupInteractiveStructure(this.fountainSprite, 'fountain');
    this.entityLayer.addChild(this.fountainSprite);
    entities.push(this.fountainSprite);

    // Self-Declaring Entity: register Courtyard Fountain base footprint
    this.collisionRegistry.register({
      id: 'collider-fountain',
      label: 'fountain',
      minX: -20,
      maxX: 60,
      minY: 270,
      maxY: 304,
      zoneId: 'zone_03_pond_courtyard',
      enabled: false,
    });

    // Decorative courtyard trees & bushes
    const treeDefs: Array<{ type: 'tree_round' | 'tree_narrow' | 'tree_bush'; x: number; y: number }> = [
      { type: 'tree_round', x: -320, y: 240 },
      { type: 'tree_narrow', x: -330, y: 420 },
      { type: 'tree_bush', x: -80, y: 220 },
      { type: 'tree_bush', x: 120, y: 220 },
      { type: 'tree_bush', x: -80, y: 400 },
      { type: 'tree_bush', x: 120, y: 400 },
      { type: 'tree_round', x: 180, y: 320 },
    ];

    treeDefs.forEach((def, i) => {
      const tree = this.createTree(def.type, def.x, def.y, `z3-tree-${i}`, 'zone_03_pond_courtyard', false);
      tree.visible = false;
      this.entityLayer.addChild(tree);
      entities.push(tree);
    });

    // Mist cover
    const mist = this.createMistOverlay(bounds, 'Courtyard & Whispering Pond');
    this.groundLayer.addChild(mist);

    this.zones.set('zone_03_pond_courtyard', {
      id: 'zone_03_pond_courtyard',
      name: 'Cobblestone Courtyard & Whispering Pond',
      tier: 3,
      groundContainer: ground,
      mistContainer: mist,
      entities,
      bounds,
      unlocked: false,
      mistAlpha: 1.0,
      isFadingMist: false,
    });
  }

  // =========================================================================
  // Zone 4: Royal Library Wing & Sunlit Balcony
  // =========================================================================
  private buildZone4LibraryBalcony(): void {
    const ground = new Container({ label: 'zone_04_ground' });
    this.groundLayer.addChild(ground);

    const bounds: ZoneBounds = { minX: -544, maxX: -192, minY: -160, maxY: 160 };

    // Fill 11 cols (-17..-7) x 10 rows (-5..4)
    for (let col = -17; col < -6; col++) {
      for (let row = -5; row < 5; row++) {
        const isStoneTerrace = col >= -13 && col <= -7 && row >= -3 && row <= 1;
        const isConnectingPath = row === 0 && col >= -7 && col <= -6;

        if (isStoneTerrace || isConnectingPath) {
          this.addGroundTile(ground, 'pave2', col, row);
        } else if (col <= -14) {
          this.addGroundTile(ground, 'forest', col, row);
        } else if ((col + row) % 4 === 0) {
          this.addGroundTile(ground, 'forest2', col, row);
        } else {
          this.addGroundTile(ground, 'lawn', col, row);
        }
      }
    }

    const entities: Container[] = [];

    // Library / Lab wing structure (112x72 at 2x = 224x144 px) attached to west of mansion
    this.mansionWestWing = new Sprite({
      texture: this.assets.buildings.lab,
      scale: 2,
      anchor: { x: 0.5, y: 1.0 },
      x: -240,
      y: -10,
      roundPixels: true,
      label: 'mansion-west-wing-library',
    });
    this.mansionWestWing.zIndex = -10;
    this.mansionWestWing.visible = false;
    this.setupInteractiveStructure(this.mansionWestWing, 'library');
    this.entityLayer.addChild(this.mansionWestWing);
    entities.push(this.mansionWestWing);

    // Self-Declaring Entity: register Library West Wing base footprint
    this.collisionRegistry.register({
      id: 'collider-mansion-west-wing',
      label: 'mansion-west-wing-library',
      minX: -300,
      maxX: -180,
      minY: -32,
      maxY: -6,
      zoneId: 'zone_04_library_balcony',
      enabled: false,
    });

    // Grove trees and elevated hedge balcony perimeter
    const treeDefs: Array<{ type: 'tree_round' | 'tree_narrow' | 'tree_bush'; x: number; y: number }> = [
      { type: 'tree_narrow', x: -440, y: -120 },
      { type: 'tree_narrow', x: -480, y: -80 },
      { type: 'tree_narrow', x: -420, y: 80 },
      { type: 'tree_round', x: -460, y: 130 },
      { type: 'tree_bush', x: -360, y: 20 },
      { type: 'tree_bush', x: -360, y: 60 },
      { type: 'tree_bush', x: -380, y: -60 },
    ];

    treeDefs.forEach((def, i) => {
      const tree = this.createTree(def.type, def.x, def.y, `z4-tree-${i}`, 'zone_04_library_balcony', false);
      tree.visible = false;
      this.entityLayer.addChild(tree);
      entities.push(tree);
    });

    // Mist cover
    const mist = this.createMistOverlay(bounds, 'Royal Library & Balcony');
    this.groundLayer.addChild(mist);

    this.zones.set('zone_04_library_balcony', {
      id: 'zone_04_library_balcony',
      name: 'Royal Library & Sunlit Balcony',
      tier: 4,
      groundContainer: ground,
      mistContainer: mist,
      entities,
      bounds,
      unlocked: false,
      mistAlpha: 1.0,
      isFadingMist: false,
    });
  }

  // =========================================================================
  // Zone 5: Starlight Observatory & Celestial Promenade
  // =========================================================================
  private buildZone5StarlightObservatory(): void {
    const ground = new Container({ label: 'zone_05_ground' });
    this.groundLayer.addChild(ground);

    const bounds: ZoneBounds = { minX: -320, maxX: 384, minY: -480, maxY: -160 };

    // Fill 22 cols (-10..11) x 10 rows (-15..-6)
    for (let col = -10; col < 12; col++) {
      for (let row = -15; row < -5; row++) {
        const isPromenade = (col === 0 || col === 1) && row >= -15 && row <= -6;
        const isObservatoryPlaza = col >= -4 && col <= 5 && row >= -15 && row <= -11;

        if (isPromenade || isObservatoryPlaza) {
          this.addGroundTile(ground, 'pave2', col, row);
        } else if ((col + row) % 3 === 0) {
          this.addGroundTile(ground, 'lawn4', col, row); // starry celestial lawn
        } else if ((col * row) % 5 === 0) {
          this.addGroundTile(ground, 'flower', col, row);
        } else {
          this.addGroundTile(ground, 'lawn2', col, row);
        }
      }
    }

    const entities: Container[] = [];

    // Starlight Observatory Dome structure (house_blue at 2x = 160x110 px)
    this.mansionObservatoryDome = new Sprite({
      texture: this.assets.buildings.house_blue,
      scale: 2,
      anchor: { x: 0.5, y: 1.0 },
      x: 16,
      y: -360,
      roundPixels: true,
      label: 'starlight-observatory-dome',
    });
    this.mansionObservatoryDome.zIndex = -360;
    this.mansionObservatoryDome.visible = false;
    this.setupInteractiveStructure(this.mansionObservatoryDome, 'observatory');
    this.entityLayer.addChild(this.mansionObservatoryDome);
    entities.push(this.mansionObservatoryDome);

    // Self-Declaring Entity: register Observatory Dome base footprint
    this.collisionRegistry.register({
      id: 'collider-starlight-observatory-dome',
      label: 'starlight-observatory-dome',
      minX: -56,
      maxX: 88,
      minY: -380,
      maxY: -356,
      zoneId: 'zone_05_starlight_observatory',
      enabled: false,
    });

    // East grand palace wing (house_purple 160x112 px)
    this.mansionEastWing = new Sprite({
      texture: this.assets.buildings.house_purple,
      scale: 2,
      anchor: { x: 0.5, y: 1.0 },
      x: 180,
      y: -10,
      roundPixels: true,
      label: 'mansion-east-wing-palace',
    });
    this.mansionEastWing.zIndex = -10;
    this.mansionEastWing.visible = false;
    this.entityLayer.addChild(this.mansionEastWing);
    entities.push(this.mansionEastWing);

    // Self-Declaring Entity: register East Wing Palace base footprint
    this.collisionRegistry.register({
      id: 'collider-mansion-east-wing',
      label: 'mansion-east-wing-palace',
      minX: 120,
      maxX: 240,
      minY: -32,
      maxY: -6,
      zoneId: 'zone_05_starlight_observatory',
      enabled: false,
    });

    // Celestial promenade trees
    const treeDefs: Array<{ type: 'tree_round' | 'tree_narrow' | 'tree_bush'; x: number; y: number }> = [
      { type: 'tree_round', x: -220, y: -320 },
      { type: 'tree_round', x: 220, y: -320 },
      { type: 'tree_narrow', x: -120, y: -420 },
      { type: 'tree_narrow', x: 120, y: -420 },
      { type: 'tree_bush', x: -80, y: -260 },
      { type: 'tree_bush', x: 100, y: -260 },
    ];

    treeDefs.forEach((def, i) => {
      const tree = this.createTree(def.type, def.x, def.y, `z5-tree-${i}`, 'zone_05_starlight_observatory', false);
      tree.visible = false;
      this.entityLayer.addChild(tree);
      entities.push(tree);
    });

    // Mist cover
    const mist = this.createMistOverlay(bounds, 'Starlight Observatory');
    this.groundLayer.addChild(mist);

    this.zones.set('zone_05_starlight_observatory', {
      id: 'zone_05_starlight_observatory',
      name: 'Starlight Observatory & Celestial Meadow',
      tier: 5,
      groundContainer: ground,
      mistContainer: mist,
      entities,
      bounds,
      unlocked: false,
      mistAlpha: 1.0,
      isFadingMist: false,
    });
  }

  // =========================================================================
  // Mansion Visual Evolution (Tiers 1-5)
  // =========================================================================
  /**
   * Updates the mansion structure to reflect the given progression tier.
   *
   * Tier 1 (Parlor): Starter cottage (house_green, 2x scale) with dusty porch
   * Tier 2 (Kitchen): Country villa (house_mid)
   * Tier 3 (Courtyard): Grand estate manor (house_red) + cobblestone courtyard + fountain
   * Tier 4 (Library): Aristocratic manor with laboratory/library wing (lab) + balconies
   * Tier 5 (Observatory): Celestial chateau (daycare / grand palace facade) + Starlight dome
   */
  public updateMansionTier(tier: number): void {
    this.currentTier = Math.max(1, Math.min(5, tier));

    switch (this.currentTier) {
      case 1:
        this.mansionMainSprite.texture = this.assets.buildings.house_green;
        this.mansionMainSprite.scale.set(1.5);
        this.mansionMainSprite.x = 0;
        this.mansionMainSprite.y = 0;
        this.mansionMainSprite.zIndex = 0;
        break;

      case 2:
        this.mansionMainSprite.texture = this.assets.buildings.house_mid;
        this.mansionMainSprite.scale.set(1.3);
        this.mansionMainSprite.x = 0;
        this.mansionMainSprite.y = 0;
        this.mansionMainSprite.zIndex = 0;
        break;

      case 3:
        this.mansionMainSprite.texture = this.assets.buildings.house_red;
        this.mansionMainSprite.scale.set(1.2);
        this.mansionMainSprite.x = 0;
        this.mansionMainSprite.y = 0;
        this.mansionMainSprite.zIndex = 0;
        break;

      case 4:
        this.mansionMainSprite.texture = this.assets.buildings.house_red;
        this.mansionMainSprite.scale.set(1.1);
        this.mansionMainSprite.x = 0;
        this.mansionMainSprite.y = 0;
        this.mansionMainSprite.zIndex = 0;
        break;

      case 5:
        // Celestial chateau palace facade
        this.mansionMainSprite.texture = this.assets.buildings.daycare;
        this.mansionMainSprite.scale.set(1.0);
        this.mansionMainSprite.x = 0;
        this.mansionMainSprite.y = 0;
        this.mansionMainSprite.zIndex = 0;
        break;
    }

    // Explicitly synchronize wing visibility with current tier
    if (this.mansionWestWing) {
      this.mansionWestWing.visible = this.currentTier >= 4;
    }
    if (this.mansionEastWing) {
      this.mansionEastWing.visible = this.currentTier >= 5;
    }
    if (this.mansionObservatoryDome) {
      this.mansionObservatoryDome.visible = this.currentTier >= 5;
    }

    // Sort entity layer so zIndex is strictly respected
    this.entityLayer.sortChildren();
  }

  // =========================================================================
  // Unlocked Territory Management & Reveal Sequences
  // =========================================================================
  /**
   * Updates which territory zones are unlocked, triggering unlock animations
   * for newly acquired zones.
   */
  public setUnlockedZones(unlockedZoneIds: string[], animate = true): void {
    let highestTier = 1;

    for (const [id, zone] of this.zones.entries()) {
      // Check if unlocked by ID or alias
      const isUnlocked =
        unlockedZoneIds.includes(id) ||
        (id === 'zone_03_pond_courtyard' && unlockedZoneIds.includes('zone_03_courtyard_pond'));

      this.collisionRegistry.setZoneCollidersEnabled(id, isUnlocked);
      if (id === 'zone_03_pond_courtyard') {
        this.collisionRegistry.setZoneCollidersEnabled('zone_03_courtyard_pond', isUnlocked);
      }

      if (isUnlocked) {
        highestTier = Math.max(highestTier, zone.tier);
        if (!zone.unlocked) {
          this.unlockZone(zone, animate);
        }
      }
    }

    this.unlockedZoneIds = new Set(unlockedZoneIds);
    this.updateMansionTier(highestTier);
  }

  /**
   * Performs the unlock transition for a specific zone.
   */
  private unlockZone(zone: ZoneVisuals, animate: boolean): void {
    zone.unlocked = true;
    this.collisionRegistry.setZoneCollidersEnabled(zone.id, true);

    // Reveal zone entities
    for (const entity of zone.entities) {
      entity.visible = true;
    }

    if (this.fountainSprite && (zone.id === 'zone_03_pond_courtyard' || zone.id === 'zone_03_courtyard_pond')) {
      this.fountainSprite.visible = true;
      this.fountainSprite.play();
    }

    if (animate) {
      zone.isFadingMist = true;

      // Spawn announcement banner
      const centerX = (zone.bounds.minX + zone.bounds.maxX) / 2;
      const centerY = (zone.bounds.minY + zone.bounds.maxY) / 2;

      this.effectsManager.spawnFloatingText({
        text: `TERRITORY UNLOCKED: ${zone.name}`,
        x: centerX,
        y: centerY,
        color: '#ffdd44',
        fontSize: 20,
        isCrit: true,
      });

      // Spawn celebratory sparkle bursts across the newly revealed land
      this.effectsManager.spawnSparkles({
        x: centerX,
        y: centerY,
        count: 24,
        color: 0xffeb3b,
      });
      this.effectsManager.spawnSparkles({
        x: centerX - 80,
        y: centerY - 40,
        count: 14,
        color: 0xa97bff,
      });
      this.effectsManager.spawnSparkles({
        x: centerX + 80,
        y: centerY + 40,
        count: 14,
        color: 0x4fc3f7,
      });
    } else {
      zone.mistAlpha = 0;
      zone.mistContainer.visible = false;
      zone.isFadingMist = false;
    }

    this.entityLayer.sortChildren();
  }

  /**
   * Checks whether a specific territory zone is currently unlocked.
   */
  public isZoneUnlocked(zoneId: string): boolean {
    return this.zones.get(zoneId)?.unlocked ?? false;
  }

  /**
   * Computes the combined spatial bounds of all currently unlocked territory zones.
   */
  public getCombinedUnlockedBounds(): ZoneBounds {
    let minX = -192;
    let maxX = 192;
    let minY = -160;
    let maxY = 160;

    for (const zone of this.zones.values()) {
      if (zone.unlocked) {
        minX = Math.min(minX, zone.bounds.minX);
        maxX = Math.max(maxX, zone.bounds.maxX);
        minY = Math.min(minY, zone.bounds.minY);
        maxY = Math.max(maxY, zone.bounds.maxY);
      }
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Per-frame render loop update for animated fountain and mist fade transitions.
   */
  public update(deltaSeconds: number): void {
    // Advance animated fountain if visible
    if (this.fountainSprite && this.fountainSprite.visible) {
      this.fountainAnimTimer += deltaSeconds;
      if (this.fountainAnimTimer >= 0.12) {
        this.fountainAnimTimer = 0;
        this.fountainFrameIndex = (this.fountainFrameIndex + 1) % this.assets.buildings.fountain.length;
        this.fountainSprite.texture = this.assets.buildings.fountain[this.fountainFrameIndex];
      }
    }

    // Advance mist fade animations
    for (const zone of this.zones.values()) {
      if (zone.isFadingMist) {
        zone.mistAlpha -= deltaSeconds * 1.5;
        if (zone.mistAlpha <= 0) {
          zone.mistAlpha = 0;
          zone.isFadingMist = false;
          zone.mistContainer.visible = false;
        } else {
          zone.mistContainer.alpha = zone.mistAlpha;
        }
      }
    }

    // Advance tree & bush wind swaying
    this.windTimer += deltaSeconds;
    if (this.windSwayEnabled) {
      const wind = Math.sin(this.windTimer * 1.6) * 0.7 + Math.sin(this.windTimer * 3.1 + 0.6) * 0.3;
      for (const item of this.decorSprites) {
        if (item.sprite.visible) {
          const sway = wind * 0.038 + Math.sin(this.windTimer * 2.3 + item.phase) * 0.015;
          item.sprite.skew.x = item.isBush ? sway * 0.5 : sway;
        }
      }
    } else {
      for (const item of this.decorSprites) {
        item.sprite.skew.x = 0;
      }
    }

    // Advance ambient fireflies drifting across the grounds
    if (this.firefliesEnabled && this.firefliesContainer && this.firefliesContainer.visible) {
      for (const f of this.fireflyData) {
        f.y -= f.vY * deltaSeconds;
        if (f.y < -120) f.y = 150;
        f.x = f.baseX + Math.sin(this.windTimer * 1.5 + f.phase) * 12;
        f.sprite.x = Math.round(f.x);
        f.sprite.y = Math.round(f.y);
        f.sprite.alpha = 0.3 + 0.7 * Math.sin(this.windTimer * 3.8 + f.phase);
      }
    }

    // Advance warm volumetric light shafts breathing pulse
    if (this.volumetricLightContainer && this.volumetricLightContainer.visible) {
      this.volumetricLightContainer.alpha = 0.88 + Math.sin(this.windTimer * 0.9) * 0.12;
    }
  }

  /**
   * Initializes floating glowing fireflies / mana wisps across the estate.
   */
  private initFireflies(): void {
    this.firefliesContainer = new Container({ label: 'estate-fireflies' });
    this.firefliesContainer.zIndex = 500;
    this.entityLayer.addChild(this.firefliesContainer);

    for (let i = 0; i < 20; i++) {
      const g = new Graphics();
      const isGold = i % 2 === 0;
      g.circle(0, 0, 1.5).fill({ color: isGold ? 0xfef08a : 0xc084fc, alpha: 0.85 });
      this.firefliesContainer.addChild(g);

      const bx = -220 + (i * 22) % 440;
      const by = -80 + (i * 17) % 220;
      this.fireflyData.push({
        x: bx,
        y: by,
        baseX: bx,
        vY: 5 + (i % 5) * 2,
        phase: (i * 0.628) % 6.28,
        sprite: g,
      });
    }
  }

  /**
   * Initializes warm golden hour volumetric sun shafts streaming from the upper-right.
   */
  private initVolumetricLight(): void {
    this.volumetricLightContainer = new Container({ label: 'estate-volumetric-sunbeams' });
    this.volumetricLightContainer.zIndex = 450;
    this.entityLayer.addChild(this.volumetricLightContainer);

    // 1. Broad Upper-Right Warm Key Light Glow (subtle golden hour warmth)
    const warmKeyGlow = new Graphics();
    warmKeyGlow.blendMode = 'add';
    warmKeyGlow.circle(240, -160, 260).fill({ color: 0xfef08a, alpha: 0.035 });
    warmKeyGlow.circle(240, -160, 140).fill({ color: 0xfbbf24, alpha: 0.025 });
    this.volumetricLightContainer.addChild(warmKeyGlow);

    // 2. Soft Atmospheric Angled Sun Shafts (~35 deg angle from upper right)
    const shaftDefs = [
      { ox: -140, w: 36, alpha: 0.040 },
      { ox: -40,  w: 44, alpha: 0.055 },
      { ox: 80,   w: 48, alpha: 0.050 },
      { ox: 200,  w: 40, alpha: 0.040 },
      { ox: 310,  w: 32, alpha: 0.030 },
    ];

    for (const shaft of shaftDefs) {
      const g = new Graphics();
      g.blendMode = 'add';
      g.poly([
        shaft.ox + 160, -260,
        shaft.ox + 160 + shaft.w, -260,
        shaft.ox - 90 + shaft.w, 320,
        shaft.ox - 90, 320,
      ]);
      g.fill({ color: 0xfef08a, alpha: shaft.alpha });
      this.volumetricLightContainer.addChild(g);
    }

    // 3. Gentle Emissive Accent Light (Soft cozy hearth & window glow from cottage)
    const cottageEmissive = new Graphics();
    cottageEmissive.blendMode = 'add';
    // Lower window soft warm golden halo
    cottageEmissive.circle(20, -24, 20).fill({ color: 0xf59e0b, alpha: 0.06 });
    cottageEmissive.circle(20, -24, 10).fill({ color: 0xfef08a, alpha: 0.08 });
    // Upper dormer / chimney gentle warmth
    cottageEmissive.circle(-26, -56, 14).fill({ color: 0xfbbf24, alpha: 0.04 });
    this.volumetricLightContainer.addChild(cottageEmissive);

    // 4. Cool Hue-Shifted Ambient Shadow (Lower-left depths)
    const coolAmbientShadow = new Graphics();
    coolAmbientShadow.circle(-240, 200, 280).fill({ color: 0x1a1236, alpha: 0.10 });
    this.volumetricLightContainer.addChild(coolAmbientShadow);
  }

  public setWindSwayEnabled(enabled: boolean): void {
    this.windSwayEnabled = enabled;
    if (!enabled) {
      for (const item of this.decorSprites) {
        item.sprite.skew.x = 0;
      }
    }
  }

  public setFirefliesEnabled(enabled: boolean): void {
    this.firefliesEnabled = enabled;
    if (this.firefliesContainer) {
      this.firefliesContainer.visible = enabled;
    }
  }

  public setVolumetricLightEnabled(enabled: boolean): void {
    if (this.volumetricLightContainer) {
      this.volumetricLightContainer.visible = enabled;
    }
  }
}
