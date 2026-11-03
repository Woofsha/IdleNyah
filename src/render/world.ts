// src/render/world.ts
import { Container, Application, FederatedPointerEvent } from 'pixi.js';
import type { GameAssets } from './assets';
import { MaidSprite } from './maids';
import { EffectsManager } from './effects';
import { EstateView } from './estate';
import { CreaturesManager } from './creatures';
import { CollisionRegistry, type WorldCollider } from './collisionRegistry';
import type { GameSimulation } from '../core/simulation';
import type { CatchResult, GameState } from '../core/types';

export { type WorldCollider };

export interface WorldViewOptions {
  app: Application;
  assets: GameAssets;
  simulation?: GameSimulation;
  onWorldClick?: (worldX: number, worldY: number, screenX: number, screenY: number) => void;
  onStructureClick?: (structureType: string, worldX: number, worldY: number) => void;
  onCatchCreature?: (wildInstanceId: string, useBait: boolean) => CatchResult;
}

/**
 * Manages the 2D pixel-art estate world, scene layers, camera pan/zoom,
 * terrain tile rendering, and depth-sorted characters/structures.
 */
export class WorldView {
  public readonly app: Application;
  public readonly assets: GameAssets;
  public readonly worldContainer: Container;
  public readonly groundLayer: Container;
  public readonly entityLayer: Container;
  public readonly effectsManager: EffectsManager;
  public readonly estateView: EstateView;
  public readonly creaturesManager: CreaturesManager;
  public readonly collisionRegistry: CollisionRegistry;

  public maidNyah: MaidSprite;
  public maidFifi: MaidSprite;

  public get colliders(): WorldCollider[] {
    return this.collisionRegistry.getColliders();
  }

  public isWalkable = (x: number, y: number, radius = 8): boolean => {
    return this.collisionRegistry.isWalkable(x, y, radius);
  };

  // Camera settings
  public cameraX = 0;
  public cameraY = 0;
  public targetCameraX = 0;
  public targetCameraY = 0;
  public zoom = 2; // 2x retro pixel magnification

  // Dynamic camera drag bounds based on unlocked territory
  public cameraBounds = {
    minX: -260,
    maxX: 260,
    minY: -180,
    maxY: 180,
  };

  // Drag-to-pan state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;
  private hasMovedSignificantly = false;

  private onWorldClickCallback?: (worldX: number, worldY: number, screenX: number, screenY: number) => void;

  constructor(options: WorldViewOptions) {
    this.app = options.app;
    this.assets = options.assets;
    this.onWorldClickCallback = options.onWorldClick;

    // Root world container
    this.worldContainer = new Container({
      label: 'world-container',
    });

    // 1. Static ground layer (32x32 tiles)
    this.groundLayer = new Container({
      label: 'ground-layer',
    });

    // 2. Y-sorted entity layer (buildings, trees, characters, creatures)
    this.entityLayer = new Container({
      label: 'entity-layer',
      sortableChildren: true,
    });

    // 3. Effects manager for floating text and sparkles
    this.effectsManager = new EffectsManager();

    this.worldContainer.addChild(this.groundLayer, this.entityLayer, this.effectsManager.container);
    this.app.stage.addChild(this.worldContainer);

    this.collisionRegistry = new CollisionRegistry();

    // Initialize Estate View (Tiers 1-5 mansion and 5 outdoor zones)
    this.estateView = new EstateView({
      groundLayer: this.groundLayer,
      entityLayer: this.entityLayer,
      effectsManager: this.effectsManager,
      assets: this.assets,
      collisionRegistry: this.collisionRegistry,
      onStructureClick: options.onStructureClick,
    });

    // Initialize Creatures Manager (Wild roaming, catching & habitats)
    this.creaturesManager = new CreaturesManager({
      entityLayer: this.entityLayer,
      effectsManager: this.effectsManager,
      simulation: options.simulation,
      onCatchCreature: options.onCatchCreature,
      isWalkable: this.isWalkable,
    });

    // Spawn maids with initial wander bounds
    this.maidNyah = new MaidSprite({
      name: 'nyah',
      frames: this.assets.nyahWorld,
      x: 0,
      y: 20,
      direction: 'down',
      isWalkable: this.isWalkable,
    });
    this.maidNyah.setWanderBounds(-80, 80, 8, 70);

    this.maidFifi = new MaidSprite({
      name: 'fifi',
      frames: this.assets.fifiWorld,
      x: -24,
      y: 56,
      direction: 'right',
      isWalkable: this.isWalkable,
    });
    this.maidFifi.setWanderBounds(-120, 60, 48, 100);

    this.entityLayer.addChild(this.maidNyah, this.maidFifi);

    // Initial camera bounds setup
    this.updateBoundsFromTerritory();

    // Setup camera and user input
    this.setupInteractivity();
    this.centerCameraOnEstate();
  }

  /**
   * Updates camera pan limits and maid wander boundaries to match all currently
   * unlocked territory zones.
   */
  public updateBoundsFromTerritory(): void {
    const combined = this.estateView.getCombinedUnlockedBounds();

    // Camera pan limits: allow viewing up to the edge of the unlocked territory
    this.cameraBounds = {
      minX: Math.min(-200, combined.minX + 60),
      maxX: Math.max(200, combined.maxX - 60),
      minY: Math.min(-140, combined.minY + 60),
      maxY: Math.max(140, combined.maxY - 60),
    };

    // Expand maid wander bounds dynamically into the unlocked regions.
    // If Starlight Observatory (Zone 5) is locked, clamp northern bounds in front of the
    // mansion porch (minY >= 12) so maids never wander into the narrow void behind the house.
    const hasNorthZone = this.estateView.isZoneUnlocked('zone_05_starlight_observatory');
    const nyahMinY = hasNorthZone ? Math.max(combined.minY + 60, -260) : 12;
    const fifiMinY = hasNorthZone ? Math.max(combined.minY + 80, -240) : 24;

    this.maidNyah.setWanderBounds(
      Math.max(combined.minX + 60, -320),
      Math.min(combined.maxX - 60, 320),
      nyahMinY,
      Math.min(combined.maxY - 60, 260)
    );

    this.maidFifi.setWanderBounds(
      Math.max(combined.minX + 40, -340),
      Math.min(combined.maxX - 40, 300),
      fifiMinY,
      Math.min(combined.maxY - 40, 280)
    );

    // If maid was trapped behind cottage or beyond new northern bounds, recover to porch
    if (this.maidNyah.y < nyahMinY) {
      this.maidNyah.x = 0;
      this.maidNyah.y = 20;
      (this.maidNyah as any).updateZIndex?.();
    }
    if (this.maidFifi.y < fifiMinY) {
      this.maidFifi.x = -24;
      this.maidFifi.y = 56;
      (this.maidFifi as any).updateZIndex?.();
    }
  }

  /**
   * Sets unlocked territory zones, expanding estate visuals and camera bounds.
   */
  public setUnlockedZones(unlockedZoneIds: string[], animate = true): void {
    this.estateView.setUnlockedZones(unlockedZoneIds, animate);
    this.creaturesManager.setUnlockedZones(unlockedZoneIds);
    this.updateBoundsFromTerritory();
  }

  /**
   * Sets up drag-to-pan camera navigation and interactive world clicking.
   */
  private setupInteractivity(): void {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.isDragging = true;
      this.hasMovedSignificantly = false;
      this.dragStartX = e.global.x;
      this.dragStartY = e.global.y;
      this.camStartX = this.cameraX;
      this.camStartY = this.cameraY;
    });

    this.app.stage.on('pointermove', (e: FederatedPointerEvent) => {
      if (!this.isDragging) return;
      const dx = (e.global.x - this.dragStartX) / this.zoom;
      const dy = (e.global.y - this.dragStartY) / this.zoom;

      if (Math.hypot(dx, dy) > 4) {
        this.hasMovedSignificantly = true;
      }

      this.targetCameraX = this.camStartX - dx;
      this.targetCameraY = this.camStartY - dy;

      // Clamp camera within dynamic territory bounds
      this.targetCameraX = Math.max(this.cameraBounds.minX, Math.min(this.cameraBounds.maxX, this.targetCameraX));
      this.targetCameraY = Math.max(this.cameraBounds.minY, Math.min(this.cameraBounds.maxY, this.targetCameraY));
    });

    const endDrag = (e: FederatedPointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      // If user clicked without dragging, trigger world click
      if (!this.hasMovedSignificantly) {
        const localPos = this.worldContainer.toLocal(e.global);
        const worldX = Math.round(localPos.x);
        const worldY = Math.round(localPos.y);

        if (this.onWorldClickCallback) {
          this.onWorldClickCallback(worldX, worldY, Math.round(e.global.x), Math.round(e.global.y));
        }
      }
    };

    this.app.stage.on('pointerup', endDrag);
    this.app.stage.on('pointerupoutside', endDrag);
  }

  /**
   * Centers the camera over the starter cottage porch.
   */
  public centerCameraOnEstate(): void {
    this.cameraX = 0;
    this.cameraY = 10;
    this.targetCameraX = 0;
    this.targetCameraY = 10;
    this.updateCameraTransform();
  }

  /**
   * Updates camera integer positioning and container scale.
   */
  private updateCameraTransform(): void {
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    this.worldContainer.scale.set(this.zoom);
    this.worldContainer.x = Math.round(-this.cameraX * this.zoom + screenWidth / 2);
    this.worldContainer.y = Math.round(-this.cameraY * this.zoom + screenHeight / 2);
  }

  /**
   * Per-frame simulation and render loop update.
   */
  public update(deltaSeconds: number, state?: GameState): void {
    // Smooth camera lerp
    this.cameraX += (this.targetCameraX - this.cameraX) * 0.2;
    this.cameraY += (this.targetCameraY - this.cameraY) * 0.2;
    this.updateCameraTransform();

    // Update estate view (fountain frames, mist fade animations)
    this.estateView.update(deltaSeconds);

    // Update animated maids
    this.maidNyah.update(deltaSeconds);
    this.maidFifi.update(deltaSeconds);

    // Update creatures (wild roaming, catching & habitat boosts)
    this.creaturesManager.update(deltaSeconds, state);

    // Update floating particle effects
    this.effectsManager.update(deltaSeconds);
  }
}
