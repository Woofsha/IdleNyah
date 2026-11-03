// src/render/creatures.ts
import { Container, Graphics, Rectangle, Sprite, Texture, FederatedPointerEvent } from 'pixi.js';
import type { EffectsManager } from './effects';
import type { CreatureSpeciesDefinition } from '../core/types';
import { findSpecies } from '../core/creatures';
import type { GameSimulation } from '../core/simulation';
import type { GameState, WildCreatureInstance, CatchResult } from '../core/types';
import type { ZoneBounds } from './estate';
import { getBespokeEstateAssets, createPixelCanvasTexture } from './bespokeAssets';

export type { ZoneBounds };

export interface HabitatVisualConfig {
  id: string;
  name: string;
  zoneId: string;
  capacity: number;
  centerX: number;
  centerY: number;
  roamBounds: ZoneBounds;
}

export const HABITAT_CONFIGS: Record<string, HabitatVisualConfig> = {
  habitat_porch: {
    id: 'habitat_porch',
    name: 'Porch Baskets',
    zoneId: 'zone_01_parlor',
    capacity: 3,
    centerX: 70,
    centerY: 30,
    roamBounds: { minX: 30, maxX: 120, minY: 10, maxY: 65 },
  },
  habitat_garden: {
    id: 'habitat_garden',
    name: 'Herb Garden Pen',
    zoneId: 'zone_02_kitchen_garden',
    capacity: 4,
    centerX: 350,
    centerY: 30,
    roamBounds: { minX: 290, maxX: 420, minY: 10, maxY: 65 },
  },
  habitat_pond: {
    id: 'habitat_pond',
    name: 'Whispering Pond',
    zoneId: 'zone_03_pond_courtyard',
    capacity: 6,
    centerX: -170,
    centerY: 300,
    roamBounds: { minX: -240, maxX: -110, minY: 250, maxY: 350 },
  },
  habitat_aviary: {
    id: 'habitat_aviary',
    name: 'Aviary Perch',
    zoneId: 'zone_04_library_balcony',
    capacity: 4,
    centerX: -320,
    centerY: -30,
    roamBounds: { minX: -380, maxX: -260, minY: -70, maxY: 10 },
  },
  habitat_sanctuary: {
    id: 'habitat_sanctuary',
    name: 'Grand Sanctuary',
    zoneId: 'zone_05_starlight_observatory',
    capacity: 12,
    centerX: 20,
    centerY: -260,
    roamBounds: { minX: -70, maxX: 110, minY: -300, maxY: -210 },
  },
};

export const ZONE_WILD_ROAM_BOUNDS: Record<string, ZoneBounds> = {
  zone_01_parlor: { minX: -150, maxX: 150, minY: -80, maxY: 120 },
  zone_02_kitchen_garden: { minX: 230, maxX: 500, minY: -120, maxY: 120 },
  zone_03_pond_courtyard: { minX: -310, maxX: 180, minY: 190, maxY: 440 },
  zone_04_library_balcony: { minX: -500, maxX: -230, minY: -120, maxY: 120 },
  zone_05_starlight_observatory: { minX: -270, maxX: 330, minY: -440, maxY: -190 },
};

export interface CreatureSpriteOptions {
  speciesId: string;
  isShiny?: boolean;
  isWild?: boolean;
  wildInstanceId?: string;
  x?: number;
  y?: number;
  roamBounds?: ZoneBounds;
  isWalkable?: (x: number, y: number, radius?: number) => boolean;
  onClick?: (sprite: CreatureSprite) => void;
}

/**
 * CreatureSprite renders bespoke retro pixel art for each of the 10 species.
 * Features an ellipse drop shadow, idle hop/bobbing animation, direction facing,
 * depth sorting (zIndex = Math.floor(y)), and autonomous roaming.
 */
export class CreatureSprite extends Container {
  public readonly speciesId: string;
  public readonly speciesDef: CreatureSpeciesDefinition;
  public readonly isShiny: boolean;
  public readonly isWild: boolean;
  public readonly wildInstanceId?: string;
  public isWalkable?: (x: number, y: number, radius?: number) => boolean;

  public shadow: Graphics;
  public visualContainer: Container;
  public creatureGraphics: Container;
  public shinyAura?: Graphics;

  public facing: 'left' | 'right' = 'right';
  public roamBounds?: ZoneBounds;

  // AI & Animation state
  private animTimer = 0;
  private aiTimer = 1.0 + Math.random() * 2.0;
  private state: 'idle' | 'walk' | 'hop' = 'idle';
  private targetX = 0;
  private targetY = 0;
  private moveSpeed = 24; // pixels per second
  private isFleeing = false;
  private fleeAlpha = 1.0;

  // Habitat boost timer
  public boostPulseTimer = 2.0 + Math.random() * 3.0;

  private onClickCallback?: (sprite: CreatureSprite) => void;

  constructor(options: CreatureSpriteOptions) {
    super({
      label: `creature-${options.speciesId}${options.isShiny ? '-shiny' : ''}`,
      x: options.x ?? 0,
      y: options.y ?? 0,
    });

    this.speciesId = options.speciesId;
    const def = findSpecies(options.speciesId);
    if (!def) {
      throw new Error(`Unknown creature speciesId: ${options.speciesId}`);
    }
    this.speciesDef = def;
    this.isShiny = options.isShiny ?? false;
    this.isWild = options.isWild ?? false;
    this.wildInstanceId = options.wildInstanceId;
    this.roamBounds = options.roamBounds;
    this.isWalkable = options.isWalkable;
    this.onClickCallback = options.onClick;

    // 1. Ellipse drop shadow on the ground
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 0, 11, 4.5);
    this.shadow.fill({ color: 0x0a0914, alpha: 0.45 });
    this.addChild(this.shadow);

    // 2. Visual container for hops and flips
    this.visualContainer = new Container({
      label: 'creature-visual',
    });
    this.addChild(this.visualContainer);

    // Shiny shimmering aura
    if (this.isShiny) {
      this.shinyAura = new Graphics();
      this.shinyAura.circle(0, -14, 15);
      this.shinyAura.fill({ color: 0xffea75, alpha: 0.22 });
      this.visualContainer.addChild(this.shinyAura);
    }

    // 3. Pixel art geometry
    this.creatureGraphics = new Container({ label: 'creature-graphics' });
    this.renderPixelArt(this.creatureGraphics, this.speciesId, this.isShiny);
    this.visualContainer.addChild(this.creatureGraphics);

    // 4. Hit area and interaction setup
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-16, -32, 32, 36);

    this.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this.onClickCallback) {
        this.onClickCallback(this);
      }
    });

    this.updateZIndex();
  }

  public setClickHandler(cb: (sprite: CreatureSprite) => void): void {
    this.onClickCallback = cb;
  }

  public setRoamBounds(bounds: ZoneBounds): void {
    this.roamBounds = bounds;
  }

  public setFacing(direction: 'left' | 'right'): void {
    this.facing = direction;
    this.visualContainer.scale.x = direction === 'left' ? -1 : 1;
  }

  public updateZIndex(): void {
    this.zIndex = Math.floor(this.y);
  }

  public triggerFlee(): void {
    this.isFleeing = true;
    this.eventMode = 'none';
  }

  /**
   * Per-frame animation and movement logic.
   */
  public update(deltaSeconds: number): void {
    this.animTimer += deltaSeconds;

    // Fleeing fadeout
    if (this.isFleeing) {
      this.fleeAlpha -= deltaSeconds * 2.5;
      this.y -= deltaSeconds * 40;
      this.alpha = Math.max(0, this.fleeAlpha);
      this.updateZIndex();
      return;
    }

    // Shiny aura subtle pulse
    if (this.shinyAura) {
      const pulse = 0.18 + Math.sin(this.animTimer * 5) * 0.08;
      this.shinyAura.alpha = pulse;
    }

    // AI State Machine for autonomous wandering
    this.aiTimer -= deltaSeconds;
    if (this.aiTimer <= 0) {
      if (this.state === 'idle') {
        // Pick new destination inside roamBounds
        if (this.roamBounds) {
          const rw = this.roamBounds.maxX - this.roamBounds.minX;
          const rh = this.roamBounds.maxY - this.roamBounds.minY;
          this.targetX = this.roamBounds.minX + Math.random() * rw;
          this.targetY = this.roamBounds.minY + Math.random() * rh;
          this.state = 'walk';
          this.aiTimer = 2.0 + Math.random() * 3.0;
        } else {
          this.aiTimer = 2.0 + Math.random() * 2.0;
        }
      } else {
        // Return to idle
        this.state = 'idle';
        this.aiTimer = 1.5 + Math.random() * 2.5;
      }
    }

    // Movement execution
    if (this.state === 'walk') {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 4) {
        this.state = 'idle';
        this.aiTimer = 1.5 + Math.random() * 2.0;
      } else {
        const step = Math.min(dist, this.moveSpeed * deltaSeconds);
        const targetX = this.x + (dx / dist) * step;
        const targetY = this.y + (dy / dist) * step;

        // Closed-Loop Navigation: test unified predicate and slide or halt upon collision
        if (!this.isWalkable || this.isWalkable(targetX, targetY, 6)) {
          this.x = targetX;
          this.y = targetY;
        } else if (this.isWalkable(targetX, this.y, 6)) {
          // Slide along X axis
          this.x = targetX;
        } else if (this.isWalkable(this.x, targetY, 6)) {
          // Slide along Y axis
          this.y = targetY;
        } else {
          this.state = 'idle';
          this.aiTimer = 1.5 + Math.random() * 2.0;
        }

        if (dx < -2) this.setFacing('left');
        else if (dx > 2) this.setFacing('right');
      }
    }

    // Clamp inside roamBounds if set
    if (this.roamBounds) {
      this.x = Math.max(this.roamBounds.minX, Math.min(this.roamBounds.maxX, this.x));
      this.y = Math.max(this.roamBounds.minY, Math.min(this.roamBounds.maxY, this.y));
    }

    // Hop/bobbing animation
    if (this.state === 'walk') {
      const hop = Math.abs(Math.sin(this.animTimer * 10)) * 5;
      this.visualContainer.y = -hop;
      const stretch = 1 + Math.sin(this.animTimer * 10) * 0.08;
      this.visualContainer.scale.y = stretch;
      this.visualContainer.scale.x = (this.facing === 'left' ? -1 : 1) * (2 - stretch);
    } else {
      const bob = Math.sin(this.animTimer * 3) * 1.5;
      this.visualContainer.y = -bob;
      this.visualContainer.scale.y = 1;
      this.visualContainer.scale.x = this.facing === 'left' ? -1 : 1;
    }

    this.updateZIndex();
  }

  // =========================================================================
  // Bespoke Pixel Art Rendering for all 10 Original Species (Zero Mixels)
  // =========================================================================
  private renderPixelArt(g: Container, speciesId: string, isShiny: boolean): void {
    const tex = getCreaturePixelTexture(speciesId, isShiny);
    const sprite = new Sprite({
      texture: tex,
      anchor: { x: 0.5, y: 1.0 },
      roundPixels: true,
    });
    g.addChild(sprite);
  }
}

// Global cache for creature pixel-art textures
const creatureTextureCache = new Map<string, Texture>();

/**
 * Creates or retrieves a cached authentic integer pixel-art texture for a creature species.
 * Rendered on a 28x28 or 32x32 pixel canvas with 3-pass storybook diorama lighting:
 * (1) Cool violet underbelly shadow, (2) Textured body clusters, (3) Warm upper-right rim light.
 */
export function getCreaturePixelTexture(speciesId: string, isShiny: boolean): Texture {
  const cacheKey = `${speciesId.toLowerCase()}_${isShiny ? 'shiny' : 'normal'}`;
  const existing = creatureTextureCache.get(cacheKey);
  if (existing) return existing;

  const width = 32;
  const height = 32;

  const texture = createPixelCanvasTexture(width, height, (ctx) => {
    const id = speciesId.toLowerCase();
    switch (id) {
      case 'purrble':
        drawPurrblePixel(ctx, isShiny);
        break;
      case 'barkling':
        drawBarklingPixel(ctx, isShiny);
        break;
      case 'mooshrum':
        drawMooshrumPixel(ctx, isShiny);
        break;
      case 'glimmerfin':
        drawGlimmerfinPixel(ctx, isShiny);
        break;
      case 'silkwisp':
        drawSilkwispPixel(ctx, isShiny);
        break;
      case 'cinderfox':
        drawCinderfoxPixel(ctx, isShiny);
        break;
      case 'bramblebeast':
        drawBramblebeastPixel(ctx, isShiny);
        break;
      case 'chrono_chirp':
        drawChronoChirpPixel(ctx, isShiny);
        break;
      case 'dewdrop_slime':
        drawDewdropSlimePixel(ctx, isShiny);
        break;
      case 'starling_doe':
        drawStarlingDoePixel(ctx, isShiny);
        break;
      default:
        drawGenericPixel(ctx, isShiny);
        break;
    }
  });

  creatureTextureCache.set(cacheKey, texture);
  return texture;
}

// 1. Purrble: Round lavender dust-bunny kitten with warm upper-right rim highlight
function drawPurrblePixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const body = shiny ? '#fef08a' : '#c4b5fd';
  const shade = shiny ? '#ca8a04' : '#7c3aed';
  const rim = shiny ? '#ffffff' : '#f5d0fe';
  const earInner = shiny ? '#fed7aa' : '#f472b6';
  const eye = shiny ? '#854d0e' : '#3b0764';

  // Drop shadow
  ctx.fillStyle = 'rgba(15, 11, 28, 0.45)';
  ctx.fillRect(8, 28, 16, 3);

  // Round body: (cx=16, cy=20, r=8)
  // Deep shadow underbelly (lower-left)
  ctx.fillStyle = shade;
  ctx.fillRect(10, 22, 12, 5);
  ctx.fillRect(9, 18, 4, 6);

  // Midtone body
  ctx.fillStyle = body;
  ctx.fillRect(11, 14, 10, 10);
  ctx.fillRect(9, 16, 14, 7);
  ctx.fillRect(8, 18, 16, 4);

  // Warm upper-right rim highlight (golden hour sun)
  ctx.fillStyle = rim;
  ctx.fillRect(16, 13, 5, 1);
  ctx.fillRect(20, 14, 3, 2);
  ctx.fillRect(22, 16, 2, 4);

  // Perky kitten ears
  // Left ear
  ctx.fillStyle = body;
  ctx.fillRect(10, 9, 3, 5);
  ctx.fillRect(11, 8, 2, 2);
  ctx.fillStyle = earInner;
  ctx.fillRect(11, 10, 1, 3);
  // Right ear (with sun rim)
  ctx.fillStyle = body;
  ctx.fillRect(19, 9, 3, 5);
  ctx.fillRect(20, 8, 2, 2);
  ctx.fillStyle = earInner;
  ctx.fillRect(20, 10, 1, 3);
  ctx.fillStyle = rim;
  ctx.fillRect(21, 8, 1, 3);

  // Fluffy round tail on left
  ctx.fillStyle = shade;
  ctx.fillRect(5, 19, 4, 4);
  ctx.fillStyle = body;
  ctx.fillRect(6, 19, 3, 3);

  // Expressive anime face
  // Left eye
  ctx.fillStyle = eye;
  ctx.fillRect(12, 18, 2, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(12, 18, 1, 1); // glint
  // Right eye
  ctx.fillStyle = eye;
  ctx.fillRect(18, 18, 2, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(18, 18, 1, 1); // glint

  // Nose and blush
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(15, 21, 2, 1);
  ctx.fillStyle = 'rgba(244, 114, 182, 0.7)';
  ctx.fillRect(10, 21, 2, 1);
  ctx.fillRect(20, 21, 2, 1);

  // Paws
  ctx.fillStyle = shade;
  ctx.fillRect(11, 26, 3, 2);
  ctx.fillRect(18, 26, 3, 2);
  ctx.fillStyle = rim;
  ctx.fillRect(19, 26, 2, 1);
}

// 2. Barkling: Acorn-shaped golden puppy with sprout leaf ears
function drawBarklingPixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const coat = shiny ? '#f87171' : '#d97706';
  const shade = shiny ? '#991b1b' : '#78350f';
  const rim = shiny ? '#fecaca' : '#fde68a';
  const cap = shiny ? '#7f1d1d' : '#451a03';
  const leaf = shiny ? '#86efac' : '#22c55e';
  const leafRim = shiny ? '#bbf7d0' : '#86efac';

  // Shadow
  ctx.fillStyle = 'rgba(15, 11, 28, 0.45)';
  ctx.fillRect(8, 28, 16, 3);

  // Body
  ctx.fillStyle = shade;
  ctx.fillRect(10, 20, 12, 7);
  ctx.fillStyle = coat;
  ctx.fillRect(11, 14, 10, 11);
  ctx.fillRect(9, 16, 14, 7);

  // Sun rim on right
  ctx.fillStyle = rim;
  ctx.fillRect(21, 16, 2, 6);
  ctx.fillRect(18, 13, 3, 1);

  // Cream chest
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(13, 20, 6, 5);

  // Acorn cap on head
  ctx.fillStyle = cap;
  ctx.fillRect(10, 10, 12, 4);
  ctx.fillRect(12, 8, 8, 3);
  ctx.fillRect(15, 6, 2, 3); // stem

  // Green sprout ears
  ctx.fillStyle = leaf;
  ctx.fillRect(8, 7, 3, 3);
  ctx.fillRect(21, 7, 3, 3);
  ctx.fillStyle = leafRim;
  ctx.fillRect(22, 6, 2, 2);

  // Face
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(12, 16, 2, 2);
  ctx.fillRect(18, 16, 2, 2);
  ctx.fillRect(15, 19, 2, 2); // nose

  // Tail
  ctx.fillStyle = cap;
  ctx.fillRect(6, 18, 3, 3);

  // Paws
  ctx.fillStyle = coat;
  ctx.fillRect(11, 26, 3, 2);
  ctx.fillRect(18, 26, 3, 2);
}

// 3. Mooshrum: Cream calf with red spotted mushroom cap
function drawMooshrumPixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const cap = shiny ? '#eab308' : '#dc2626';
  const capShade = shiny ? '#854d0e' : '#7f1d1d';
  const capRim = shiny ? '#fef08a' : '#f87171';
  const patch = shiny ? '#6d28d9' : '#1e293b';

  ctx.fillStyle = 'rgba(15, 11, 28, 0.45)';
  ctx.fillRect(8, 28, 16, 3);

  // White heifer body
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(10, 20, 12, 7);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(11, 14, 10, 11);
  ctx.fillRect(9, 16, 14, 7);

  // Dairy spots
  ctx.fillStyle = patch;
  ctx.fillRect(10, 15, 4, 4);
  ctx.fillRect(18, 20, 4, 4);

  // Red mushroom cap
  ctx.fillStyle = capShade;
  ctx.fillRect(8, 10, 16, 4);
  ctx.fillStyle = cap;
  ctx.fillRect(9, 7, 14, 4);
  ctx.fillRect(11, 5, 10, 3);
  ctx.fillStyle = capRim;
  ctx.fillRect(16, 5, 5, 2);

  // White mushroom spots
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(11, 8, 2, 2);
  ctx.fillRect(17, 7, 2, 2);
  ctx.fillRect(14, 10, 2, 2);

  // Pink cow muzzle
  ctx.fillStyle = '#fbcfe8';
  ctx.fillRect(13, 21, 6, 4);
  ctx.fillStyle = '#9d174d';
  ctx.fillRect(14, 22, 1, 1);
  ctx.fillRect(17, 22, 1, 1);

  // Eyes
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(11, 17, 2, 2);
  ctx.fillRect(19, 17, 2, 2);

  // Hooves
  ctx.fillStyle = '#475569';
  ctx.fillRect(11, 26, 3, 2);
  ctx.fillRect(18, 26, 3, 2);
}

// 4. Glimmerfin: Celestial aquatic sprite with flowing fins
function drawGlimmerfinPixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const body = shiny ? '#f472b6' : '#0284c7';
  const shade = shiny ? '#9d174d' : '#034a70';
  const rim = shiny ? '#fbcfe8' : '#7dd3fc';
  const fin = shiny ? '#fde047' : '#38bdf8';

  ctx.fillStyle = 'rgba(15, 11, 28, 0.35)';
  ctx.fillRect(9, 27, 14, 2);

  // Body
  ctx.fillStyle = shade;
  ctx.fillRect(11, 17, 10, 7);
  ctx.fillStyle = body;
  ctx.fillRect(12, 12, 8, 10);
  ctx.fillRect(10, 14, 12, 6);
  ctx.fillStyle = rim;
  ctx.fillRect(16, 12, 4, 1);
  ctx.fillRect(20, 14, 2, 4);

  // Translucent glowing fins
  ctx.fillStyle = fin;
  ctx.fillRect(6, 13, 4, 6);
  ctx.fillRect(22, 13, 4, 6);
  // Head crest
  ctx.fillRect(15, 7, 2, 5);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(15, 6, 2, 2);

  // Ribbon tail
  ctx.fillStyle = fin;
  ctx.fillRect(14, 23, 4, 4);
  ctx.fillRect(13, 26, 6, 2);

  // Eyes
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(12, 15, 2, 2);
  ctx.fillRect(18, 15, 2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(13, 15, 1, 1);
  ctx.fillRect(19, 15, 1, 1);
}

// 5. Silkwisp: Fluffy yarn moth with golden antennae
function drawSilkwispPixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const body = shiny ? '#1e1b4b' : '#f8fafc';
  const shade = shiny ? '#0f172a' : '#cbd5e1';
  const wing = shiny ? '#38bdf8' : '#ede9fe';
  const trim = shiny ? '#818cf8' : '#c084fc';
  const ant = '#f59e0b';

  ctx.fillStyle = 'rgba(15, 11, 28, 0.3)';
  ctx.fillRect(9, 27, 14, 2);

  // Wings
  ctx.fillStyle = wing;
  ctx.fillRect(5, 10, 7, 11);
  ctx.fillRect(20, 10, 7, 11);
  ctx.fillStyle = trim;
  ctx.fillRect(4, 14, 2, 8);
  ctx.fillRect(26, 14, 2, 8);

  // Fluffy body
  ctx.fillStyle = shade;
  ctx.fillRect(13, 17, 6, 8);
  ctx.fillStyle = body;
  ctx.fillRect(14, 12, 4, 11);
  ctx.fillRect(13, 14, 6, 7);

  // Golden antennae
  ctx.fillStyle = ant;
  ctx.fillRect(12, 7, 2, 5);
  ctx.fillRect(18, 7, 2, 5);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(11, 6, 2, 2);
  ctx.fillRect(19, 6, 2, 2);

  // Eyes
  ctx.fillStyle = '#3b0764';
  ctx.fillRect(13, 14, 2, 2);
  ctx.fillRect(17, 14, 2, 2);
}

// 6. Cinderfox: Terracotta fox with glowing flame tail
function drawCinderfoxPixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const coat = shiny ? '#e2e8f0' : '#ea580c';
  const shade = shiny ? '#64748b' : '#7c2d12';
  const rim = shiny ? '#ffffff' : '#fed7aa';
  const flame = shiny ? '#38bdf8' : '#f97316';
  const flameCore = shiny ? '#fef08a' : '#fde047';

  ctx.fillStyle = 'rgba(15, 11, 28, 0.45)';
  ctx.fillRect(8, 28, 16, 3);

  // Fox body
  ctx.fillStyle = shade;
  ctx.fillRect(10, 20, 12, 7);
  ctx.fillStyle = coat;
  ctx.fillRect(11, 14, 10, 11);
  ctx.fillRect(9, 16, 14, 7);
  ctx.fillStyle = rim;
  ctx.fillRect(18, 14, 3, 1);
  ctx.fillRect(21, 16, 2, 5);

  // White chest
  ctx.fillStyle = '#fff7ed';
  ctx.fillRect(13, 19, 6, 6);

  // Pointed ears with black tips
  ctx.fillStyle = coat;
  ctx.fillRect(10, 8, 3, 6);
  ctx.fillRect(19, 8, 3, 6);
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(10, 7, 2, 3);
  ctx.fillRect(20, 7, 2, 3);

  // Flame tail
  ctx.fillStyle = coat;
  ctx.fillRect(5, 17, 5, 5);
  ctx.fillStyle = flame;
  ctx.fillRect(3, 13, 5, 6);
  ctx.fillStyle = flameCore;
  ctx.fillRect(4, 14, 3, 3);

  // Face
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(12, 16, 2, 2);
  ctx.fillRect(18, 16, 2, 2);
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(15, 19, 2, 2);

  // Paws
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(11, 26, 3, 2);
  ctx.fillRect(18, 26, 3, 2);
}

// 7. Bramblebeast: Emerald hedgehog with sweet blackberry vines
function drawBramblebeastPixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const green = shiny ? '#d97706' : '#15803d';
  const shade = shiny ? '#78350f' : '#14532d';
  const rim = shiny ? '#fde68a' : '#86efac';
  const berry = shiny ? '#2563eb' : '#581c87';

  ctx.fillStyle = 'rgba(15, 11, 28, 0.45)';
  ctx.fillRect(7, 28, 18, 3);

  // Body
  ctx.fillStyle = shade;
  ctx.fillRect(9, 19, 14, 8);
  ctx.fillStyle = green;
  ctx.fillRect(10, 14, 12, 11);
  ctx.fillRect(8, 16, 16, 7);
  ctx.fillStyle = rim;
  ctx.fillRect(18, 14, 4, 1);
  ctx.fillRect(22, 16, 2, 5);

  // Spines
  ctx.fillStyle = shade;
  ctx.fillRect(7, 11, 4, 4);
  ctx.fillRect(12, 9, 4, 4);
  ctx.fillRect(17, 10, 4, 4);

  // Blackberries and flowers
  ctx.fillStyle = berry;
  ctx.fillRect(11, 14, 3, 3);
  ctx.fillRect(17, 16, 3, 3);
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(14, 11, 3, 2);

  // Snout
  ctx.fillStyle = '#d97706';
  ctx.fillRect(22, 20, 4, 3);
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(25, 20, 1, 2);
  ctx.fillRect(19, 17, 2, 2); // eye

  // Paws
  ctx.fillStyle = '#d97706';
  ctx.fillRect(11, 26, 3, 2);
  ctx.fillRect(18, 26, 3, 2);
}

// 8. Chrono-Chirp: Brass clockwork pocket owl
function drawChronoChirpPixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const brass = shiny ? '#e2e8f0' : '#d97706';
  const shade = shiny ? '#64748b' : '#78350f';
  const rim = shiny ? '#ffffff' : '#fde68a';
  const dial = '#fef3c7';

  ctx.fillStyle = 'rgba(15, 11, 28, 0.4)';
  ctx.fillRect(9, 28, 14, 3);

  // Body
  ctx.fillStyle = shade;
  ctx.fillRect(11, 18, 10, 8);
  ctx.fillStyle = brass;
  ctx.fillRect(12, 12, 8, 12);
  ctx.fillRect(10, 14, 12, 8);
  ctx.fillStyle = rim;
  ctx.fillRect(16, 12, 4, 1);
  ctx.fillRect(20, 14, 2, 6);

  // Windup key on head
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(15, 7, 2, 5);
  ctx.fillRect(13, 6, 6, 2);

  // Clock dial chest
  ctx.fillStyle = dial;
  ctx.fillRect(13, 18, 6, 6);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(15, 20, 2, 1);
  ctx.fillRect(15, 19, 1, 2);

  // Gear eyes
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(11, 14, 3, 3);
  ctx.fillRect(18, 14, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(12, 14, 1, 1);
  ctx.fillRect(19, 14, 1, 1);

  // Beak
  ctx.fillStyle = '#78350f';
  ctx.fillRect(15, 16, 2, 2);

  // Talons
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(12, 26, 2, 2);
  ctx.fillRect(18, 26, 2, 2);
}

// 9. Dewdrop Slime: Translucent teardrop slime with lily pad
function drawDewdropSlimePixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const jelly = shiny ? '#fb7185' : '#38bdf8';
  const shade = shiny ? '#9f1239' : '#0284c7';
  const rim = shiny ? '#ffe4e6' : '#e0f2fe';

  ctx.fillStyle = 'rgba(15, 11, 28, 0.35)';
  ctx.fillRect(9, 28, 14, 3);

  // Slime body
  ctx.fillStyle = shade;
  ctx.fillRect(10, 21, 12, 7);
  ctx.fillStyle = jelly;
  ctx.fillRect(11, 15, 10, 11);
  ctx.fillRect(13, 11, 6, 5);
  ctx.fillRect(15, 8, 2, 3); // top point

  // Sun rim highlight
  ctx.fillStyle = rim;
  ctx.fillRect(18, 14, 3, 2);
  ctx.fillRect(20, 16, 2, 7);

  // Lotus blossom on head
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(11, 9, 4, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(12, 10, 2, 2);

  // Face
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(13, 19, 2, 2);
  ctx.fillRect(18, 19, 2, 2);
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(11, 21, 2, 1);
  ctx.fillRect(20, 21, 2, 1);
}

// 10. Starling Doe: Astral fawn with crystalline antlers
function drawStarlingDoePixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  const coat = shiny ? '#f43f5e' : '#818cf8';
  const shade = shiny ? '#881337' : '#4338ca';
  const rim = shiny ? '#fecdd3' : '#e0e7ff';
  const horn = shiny ? '#fde047' : '#c084fc';

  ctx.fillStyle = 'rgba(15, 11, 28, 0.4)';
  ctx.fillRect(8, 28, 16, 3);

  // Fawn body
  ctx.fillStyle = shade;
  ctx.fillRect(9, 18, 14, 7);
  ctx.fillStyle = coat;
  ctx.fillRect(11, 13, 10, 10);
  ctx.fillStyle = rim;
  ctx.fillRect(18, 13, 3, 1);
  ctx.fillRect(20, 15, 2, 6);

  // Starlight spots
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(12, 16, 1, 1);
  ctx.fillRect(14, 19, 1, 1);
  ctx.fillRect(16, 17, 1, 1);

  // Crystal antlers
  ctx.fillStyle = horn;
  ctx.fillRect(12, 7, 2, 6);
  ctx.fillRect(18, 7, 2, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(11, 5, 2, 2);
  ctx.fillRect(19, 5, 2, 2);

  // Eye
  ctx.fillStyle = '#fae8ff';
  ctx.fillRect(17, 14, 2, 2);

  // Slender legs
  ctx.fillStyle = shade;
  ctx.fillRect(11, 24, 2, 4);
  ctx.fillRect(18, 24, 2, 4);
  ctx.fillStyle = '#ffffff'; // hooves
  ctx.fillRect(11, 27, 2, 1);
  ctx.fillRect(18, 27, 2, 1);
}

function drawGenericPixel(ctx: CanvasRenderingContext2D, shiny: boolean): void {
  drawPurrblePixel(ctx, shiny);
}

// ===========================================================================
// CreaturesManager: Wild Spawning, Interactive Catching & Habitat Sync
// ===========================================================================
export interface CreaturesManagerOptions {
  entityLayer: Container;
  effectsManager: EffectsManager;
  simulation?: GameSimulation;
  onCatchCreature?: (wildInstanceId: string, useBait: boolean) => CatchResult;
  isWalkable?: (x: number, y: number, radius?: number) => boolean;
}

export class CreaturesManager {
  public readonly entityLayer: Container;
  public readonly effectsManager: EffectsManager;
  public simulation?: GameSimulation;
  public isWalkable?: (x: number, y: number, radius?: number) => boolean;

  private onCatchCallback?: (wildInstanceId: string, useBait: boolean) => CatchResult;

  // Active wild creatures on the map
  private wildSprites = new Map<string, CreatureSprite>();

  // Active assigned habitat creatures on the map
  private habitatSprites = new Map<string, CreatureSprite[]>();

  // Habitat grounds decor graphics
  private habitatDecorContainer: Container;

  // Track unlocked zones
  private unlockedZoneIds = new Set<string>(['zone_01_parlor']);

  constructor(options: CreaturesManagerOptions) {
    this.entityLayer = options.entityLayer;
    this.effectsManager = options.effectsManager;
    this.simulation = options.simulation;
    this.onCatchCallback = options.onCatchCreature;
    this.isWalkable = options.isWalkable;

    // Decor container sits in entityLayer (sorted appropriately)
    this.habitatDecorContainer = new Container({
      label: 'habitat-decor-container',
    });
    this.entityLayer.addChild(this.habitatDecorContainer);

    this.initHabitatDecor();
  }

  public setSimulation(simulation: GameSimulation): void {
    this.simulation = simulation;
  }

  public setUnlockedZones(unlockedZoneIds: string[]): void {
    this.unlockedZoneIds = new Set(unlockedZoneIds);
    this.updateHabitatDecorVisibility();
  }

  /**
   * Initializes visual outdoor habitat decor (pens, baskets, pond rim, perches, sanctuary).
   */
  private initHabitatDecor(): void {
    // 1. Habitat Porch: Baskets (Zone 1) - Authentic pixel art wicker baskets
    const bespoke = getBespokeEstateAssets();
    const porchDecor = new Container({ label: 'decor-habitat-porch', zIndex: 30 });
    const basket1 = new Sprite({
      texture: bespoke.wickerBasket,
      x: 52,
      y: 26,
      roundPixels: true,
    });
    const basket2 = new Sprite({
      texture: bespoke.wickerBasket,
      x: 76,
      y: 30,
      roundPixels: true,
    });
    porchDecor.addChild(basket1, basket2);
    this.habitatDecorContainer.addChild(porchDecor);

    // 2. Habitat Garden: Herb Garden Pen (Zone 2)
    const gardenDecor = new Graphics();
    gardenDecor.label = 'decor-habitat-garden';
    // Wooden post fence perimeter and water trough
    gardenDecor.rect(290, 8, 120, 3).fill({ color: 0x78350f });
    gardenDecor.rect(290, 8, 3, 56).fill({ color: 0x78350f });
    gardenDecor.rect(407, 8, 3, 56).fill({ color: 0x78350f });
    // Water trough
    gardenDecor.rect(380, 20, 20, 10).fill({ color: 0x475569 });
    gardenDecor.rect(382, 22, 16, 6).fill({ color: 0x38bdf8 });
    gardenDecor.zIndex = 8;
    this.habitatDecorContainer.addChild(gardenDecor);

    // 3. Habitat Pond: Whispering Pond Deck / Rock rim (Zone 3)
    const pondDecor = new Graphics();
    pondDecor.label = 'decor-habitat-pond';
    // Stone rim around sanctuary shore with reeds and lilypads
    pondDecor.circle(-180, 280, 8).fill({ color: 0x15803d }); // lilypad
    pondDecor.circle(-150, 320, 10).fill({ color: 0x166534 }); // lilypad
    pondDecor.ellipse(-130, 290, 8, 4).fill({ color: 0x94a3b8 }); // flat basking rock
    pondDecor.zIndex = 260;
    this.habitatDecorContainer.addChild(pondDecor);

    // 4. Habitat Aviary: Aviary Perch (Zone 4)
    const aviaryDecor = new Graphics();
    aviaryDecor.label = 'decor-habitat-aviary';
    // Ornate brass perch stand
    aviaryDecor.rect(-322, -60, 4, 30).fill({ color: 0xb45309 });
    aviaryDecor.rect(-335, -60, 30, 4).fill({ color: 0xfbbf24 });
    aviaryDecor.circle(-335, -58, 3).fill({ color: 0xfde047 });
    aviaryDecor.circle(-305, -58, 3).fill({ color: 0xfde047 });
    aviaryDecor.zIndex = -40;
    this.habitatDecorContainer.addChild(aviaryDecor);

    // 5. Habitat Sanctuary: Grand Sanctuary Astral Circle (Zone 5)
    const sanctuaryDecor = new Graphics();
    sanctuaryDecor.label = 'decor-habitat-sanctuary';
    // Cosmic runic glowing stone circle
    sanctuaryDecor.circle(20, -260, 36).stroke({ color: 0x818cf8, width: 2, alpha: 0.7 });
    sanctuaryDecor.circle(20, -260, 28).stroke({ color: 0xc084fc, width: 1, alpha: 0.5 });
    sanctuaryDecor.circle(20, -260, 4).fill({ color: 0xffffff, alpha: 0.8 });
    sanctuaryDecor.zIndex = -270;
    this.habitatDecorContainer.addChild(sanctuaryDecor);

    this.updateHabitatDecorVisibility();
  }

  private updateHabitatDecorVisibility(): void {
    for (const child of this.habitatDecorContainer.children) {
      if (child.label === 'decor-habitat-porch') {
        child.visible = this.unlockedZoneIds.has('zone_01_parlor');
      } else if (child.label === 'decor-habitat-garden') {
        child.visible = this.unlockedZoneIds.has('zone_02_kitchen_garden');
      } else if (child.label === 'decor-habitat-pond') {
        child.visible =
          this.unlockedZoneIds.has('zone_03_pond_courtyard') ||
          this.unlockedZoneIds.has('zone_03_courtyard_pond');
      } else if (child.label === 'decor-habitat-aviary') {
        child.visible = this.unlockedZoneIds.has('zone_04_library_balcony');
      } else if (child.label === 'decor-habitat-sanctuary') {
        child.visible = this.unlockedZoneIds.has('zone_05_starlight_observatory');
      }
    }
  }

  /**
   * Main per-frame update loop:
   * 1. Synchronizes wild creatures from state.creatures.wildActive
   * 2. Synchronizes assigned habitat creatures from state.creatures.caught
   * 3. Updates creature animations & autonomous roaming
   * 4. Updates habitat passive boost sparkle pulses
   */
  public update(deltaSeconds: number, state?: GameState): void {
    const currentState = state ?? this.simulation?.getState();
    if (!currentState) return;

    // 1. Sync Wild Creatures
    this.syncWildCreatures(currentState);

    // 2. Sync Habitat Assigned Creatures
    this.syncHabitatCreatures(currentState);

    // 3. Update all wild creature sprites
    for (const [id, sprite] of this.wildSprites.entries()) {
      sprite.update(deltaSeconds);
      if (sprite.alpha <= 0) {
        this.entityLayer.removeChild(sprite);
        sprite.destroy();
        this.wildSprites.delete(id);
      }
    }

    // 4. Update all habitat creature sprites & boost sparkles
    for (const [, sprites] of this.habitatSprites.entries()) {
      for (const sprite of sprites) {
        sprite.update(deltaSeconds);

        // Periodic boost pulse indicating passive production
        sprite.boostPulseTimer -= deltaSeconds;
        if (sprite.boostPulseTimer <= 0) {
          sprite.boostPulseTimer = 4.0 + Math.random() * 4.0;
          this.emitHabitatBoostPulse(sprite);
        }
      }
    }
  }

  /**
   * Synchronizes active wild creatures with simulation state.
   */
  private syncWildCreatures(state: GameState): void {
    const activeIds = new Set(state.creatures.wildActive.map((w) => w.id));

    // Remove expired or caught wild sprites
    for (const [id, sprite] of this.wildSprites.entries()) {
      if (!activeIds.has(id)) {
        sprite.triggerFlee();
      }
    }

    // Add new wild creatures
    for (const wildInstance of state.creatures.wildActive) {
      if (!this.wildSprites.has(wildInstance.id)) {
        this.spawnWildSprite(wildInstance);
      }
    }
  }

  /**
   * Instantiates a new wild creature sprite placed within its designated zone bounds.
   */
  private spawnWildSprite(wildInstance: WildCreatureInstance): void {
    const roam = ZONE_WILD_ROAM_BOUNDS[wildInstance.zoneId] ?? {
      minX: -100,
      maxX: 100,
      minY: -50,
      maxY: 50,
    };

    // Calculate clamped spawn position within the zone
    const spawnX = Math.max(roam.minX + 10, Math.min(roam.maxX - 10, wildInstance.x));
    const spawnY = Math.max(roam.minY + 10, Math.min(roam.maxY - 10, wildInstance.y));

    const sprite = new CreatureSprite({
      speciesId: wildInstance.speciesId,
      isShiny: Math.random() < 0.05,
      isWild: true,
      wildInstanceId: wildInstance.id,
      x: spawnX,
      y: spawnY,
      roamBounds: roam,
      isWalkable: this.isWalkable,
      onClick: (clickedSprite) => {
        this.handleWildClick(clickedSprite);
      },
    });

    this.entityLayer.addChild(sprite);
    this.wildSprites.set(wildInstance.id, sprite);

    // Spawn subtle entry puff
    this.effectsManager.spawnSparkles({
      x: spawnX,
      y: spawnY,
      count: 6,
      color: 0xffffff,
    });
  }

  /**
   * Handles user click on a wild creature: attempts catch with bait support and floating feedback.
   */
  public handleWildClick(sprite: CreatureSprite): CatchResult {
    if (sprite.destroyed || !sprite.wildInstanceId || !this.wildSprites.has(sprite.wildInstanceId)) {
      return { success: false, speciesId: sprite.speciesId, fled: false };
    }

    // Check bait availability (use treats if player has >= 1)
    let useBait = false;
    if (this.simulation) {
      const treats = this.simulation.getState().currencies.treats;
      if (treats >= 1) {
        useBait = true;
      }
    }

    let result: CatchResult;
    if (this.onCatchCallback) {
      result = this.onCatchCallback(sprite.wildInstanceId, useBait);
    } else if (this.simulation) {
      result = this.simulation.attemptCatchCreature(sprite.wildInstanceId, useBait);
    } else {
      result = { success: true, speciesId: sprite.speciesId, isShiny: sprite.isShiny };
    }

    const worldX = Math.round(sprite.x);
    const worldY = Math.round(sprite.y);

    if (result.success) {
      // Celebratory sparkle bursts
      const sparkleColor = result.isShiny ? 0xffeb3b : 0xffd700;
      this.effectsManager.spawnSparkles({
        x: worldX,
        y: worldY - 12,
        count: 18,
        color: sparkleColor,
      });

      const title = result.isShiny ? 'SHINY GOTCHA!' : 'GOTCHA!';
      const baitNotice = useBait ? ' [Bait Used!]' : '';
      this.effectsManager.spawnFloatingText({
        text: `${title} +1 ${sprite.speciesDef.name}${baitNotice}`,
        x: worldX,
        y: worldY - 24,
        color: result.isShiny ? '#ffdd44' : '#81c784',
        fontSize: 16,
        isCrit: true,
      });

      // Remove sprite immediately
      this.entityLayer.removeChild(sprite);
      sprite.destroy();
      this.wildSprites.delete(sprite.wildInstanceId);
    } else {
      if (result.fled) {
        this.effectsManager.spawnFloatingText({
          text: `${sprite.speciesDef.name} fled into the wild!`,
          x: worldX,
          y: worldY - 20,
          color: '#ff6b6b',
          fontSize: 14,
          isCrit: false,
        });
        sprite.triggerFlee();
      } else {
        this.effectsManager.spawnFloatingText({
          text: `Broke free!`,
          x: worldX,
          y: worldY - 20,
          color: '#ffa726',
          fontSize: 14,
          isCrit: false,
        });
        this.effectsManager.spawnSparkles({
          x: worldX,
          y: worldY - 10,
          count: 5,
          color: 0xffa726,
        });
      }
    }

    return result;
  }

  /**
   * Synchronizes assigned habitat creatures with simulation state.
   */
  private syncHabitatCreatures(state: GameState): void {
    // Group assigned creatures by habitat
    const assignedByHabitat = new Map<string, Array<{ speciesId: string; count: number; isShiny?: boolean }>>();

    for (const hab of Object.values(HABITAT_CONFIGS)) {
      assignedByHabitat.set(hab.id, []);
    }

    for (const [specId, cData] of Object.entries(state.creatures.caught)) {
      if (cData.count > 0 && cData.assignedHabitat) {
        const list = assignedByHabitat.get(cData.assignedHabitat);
        if (list) {
          list.push({ speciesId: specId, count: cData.count, isShiny: cData.isShiny });
        }
      }
    }

    // For each habitat, synchronize sprites
    for (const [habId, config] of Object.entries(HABITAT_CONFIGS)) {
      // Check if habitat zone is unlocked
      const isZoneUnlocked = this.unlockedZoneIds.has(config.zoneId);
      const existingSprites = this.habitatSprites.get(habId) ?? [];

      if (!isZoneUnlocked) {
        // Hide/remove existing sprites if zone is locked
        if (existingSprites.length > 0) {
          for (const s of existingSprites) {
            this.entityLayer.removeChild(s);
            s.destroy();
          }
          this.habitatSprites.set(habId, []);
        }
        continue;
      }

      const assignedList = assignedByHabitat.get(habId) ?? [];
      const desiredSpecies: Array<{ speciesId: string; isShiny?: boolean }> = [];

      for (const item of assignedList) {
        // Spawn up to 2 sprites per assigned species (capped at habitat capacity)
        const countToSpawn = Math.min(2, item.count);
        for (let i = 0; i < countToSpawn; i++) {
          if (desiredSpecies.length < config.capacity) {
            desiredSpecies.push({ speciesId: item.speciesId, isShiny: item.isShiny });
          }
        }
      }

      // If counts or species match, preserve existing sprites
      const currentKeys = existingSprites.map((s) => s.speciesId).sort().join(',');
      const desiredKeys = desiredSpecies.map((s) => s.speciesId).sort().join(',');

      if (currentKeys !== desiredKeys) {
        // Rebuild habitat sprites
        for (const s of existingSprites) {
          this.entityLayer.removeChild(s);
          s.destroy();
        }

        const newSprites: CreatureSprite[] = [];
        desiredSpecies.forEach((item, index) => {
          // Spread positions around habitat center
          const offsetX = (index - desiredSpecies.length / 2) * 24 + (Math.random() - 0.5) * 12;
          const offsetY = (Math.random() - 0.5) * 16;
          const posX = config.centerX + offsetX;
          const posY = config.centerY + offsetY;

          const sprite = new CreatureSprite({
            speciesId: item.speciesId,
            isShiny: item.isShiny,
            isWild: false,
            x: posX,
            y: posY,
            roamBounds: config.roamBounds,
            isWalkable: this.isWalkable,
            onClick: (clicked) => {
              this.handleHabitatPetting(clicked);
            },
          });

          this.entityLayer.addChild(sprite);
          newSprites.push(sprite);
        });

        this.habitatSprites.set(habId, newSprites);
      }
    }
  }

  /**
   * Friendly interaction when clicking on an assigned habitat creature (petting).
   */
  private handleHabitatPetting(sprite: CreatureSprite): void {
    if (sprite.destroyed) return;
    const quotes: Record<string, string> = {
      purrble: 'Purrble purrs softly and nuzzles your fingers!',
      barkling: 'Barkling wags its acorn tail happily!',
      mooshrum: 'Mooshrum nudges you for sweet cream clover!',
      glimmerfin: 'Glimmerfin ripples soothing fountain droplets!',
      silkwisp: 'Silkwisp glows with comforting golden warmth!',
      cinderfox: 'Cinderfox purrs with toasty crackling embers!',
      bramblebeast: 'Bramblebeast happily presents a sweet ripe berry!',
      chrono_chirp: 'Chrono-Chirp chimes a cheerful clockwork song!',
      dewdrop_slime: 'Dewdrop Slime curtsies sweetly with its bucket!',
      starling_doe: 'Starling Doe glimmers with celestial starlight!',
    };

    const quote = quotes[sprite.speciesId] ?? `${sprite.speciesDef.name} looks delighted!`;
    const worldX = Math.round(sprite.x);
    const worldY = Math.round(sprite.y);

    this.effectsManager.spawnFloatingText({
      text: quote,
      x: worldX,
      y: worldY - 26,
      color: '#ffdd44',
      fontSize: 14,
      isCrit: true,
    });

    this.effectsManager.spawnSparkles({
      x: worldX,
      y: worldY - 14,
      count: 8,
      color: 0xffd700,
    });
  }

  /**
   * Periodic boost pulse animation indicating passive resource generation.
   */
  private emitHabitatBoostPulse(sprite: CreatureSprite): void {
    const spec = sprite.speciesDef;
    let particleColor = 0xffd700; // Gold
    let label = '+g';

    if (spec.essencePerSec > 0) {
      particleColor = 0xa97bff; // Essence
      label = '+essence';
    } else if (spec.treatsPerSec > 0) {
      particleColor = 0xc98a52; // Treats
      label = '+treats';
    }

    this.effectsManager.spawnSparkles({
      x: sprite.x,
      y: sprite.y - 10,
      count: 4,
      color: particleColor,
    });
  }

  // =========================================================================
  // Query Helpers
  // =========================================================================
  public getWildCreatures(): CreatureSprite[] {
    return Array.from(this.wildSprites.values());
  }

  public getHabitatCreatures(habitatId?: string): CreatureSprite[] {
    if (habitatId) {
      return this.habitatSprites.get(habitatId) ?? [];
    }
    const all: CreatureSprite[] = [];
    for (const list of this.habitatSprites.values()) {
      all.push(...list);
    }
    return all;
  }

  public getHabitatConfig(habitatId: string): HabitatVisualConfig | undefined {
    return HABITAT_CONFIGS[habitatId];
  }
}
