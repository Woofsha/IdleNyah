// src/render/maids.ts
import { Container, AnimatedSprite, Graphics, Point } from 'pixi.js';
import type { MaidCharacterFrames } from './assets';

export type MaidDirection = 'down' | 'up' | 'left' | 'right';
export type MaidState = 'idle' | 'walk' | 'chore';

export interface MaidSpriteOptions {
  name: 'nyah' | 'fifi';
  frames: MaidCharacterFrames;
  x?: number;
  y?: number;
  direction?: MaidDirection;
  speed?: number; // pixels per second when walking
  isWalkable?: (x: number, y: number, radius?: number) => boolean;
}

/**
 * Animated maid character class for Nyah and Fifi.
 * Extends PixiJS Container to hold the AnimatedSprite leaf, shadow, and speech anchor.
 */
export class MaidSprite extends Container {
  public readonly maidName: 'nyah' | 'fifi';
  public isWalkable?: (x: number, y: number, radius?: number) => boolean;
  private frames: MaidCharacterFrames;
  private animSprite: AnimatedSprite;
  private shadow: Graphics;
  private speechAnchor: Container;

  private currentState: MaidState = 'idle';
  private currentDirection: MaidDirection = 'down';
  private moveTarget: Point | null = null;
  private walkSpeed = 48; // px / sec

  // Chore & idle timer AI
  private aiTimer = 0;
  private choreDuration = 3.0; // seconds
  private wanderBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
  private consecutiveCollisions = 0;
  private onClickCallback?: () => void;

  constructor(options: MaidSpriteOptions) {
    super({
      x: options.x ?? 0,
      y: options.y ?? 0,
      label: `maid-${options.name}`,
    });

    this.maidName = options.name;
    this.frames = options.frames;
    this.currentDirection = options.direction ?? 'down';
    this.walkSpeed = options.speed ?? (options.name === 'nyah' ? 52 : 44);
    this.isWalkable = options.isWalkable;

    // Drop shadow under feet
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 0, 12, 5);
    this.shadow.fill({ color: 0x0a0914, alpha: 0.45 });
    this.addChild(this.shadow);

    // Main character AnimatedSprite leaf (anchor at bottom center feet)
    this.animSprite = new AnimatedSprite(this.frames.down.walk);
    this.animSprite.anchor.set(0.5, 1.0);
    this.animSprite.animationSpeed = 0.12;
    this.animSprite.roundPixels = true;
    this.addChild(this.animSprite);

    // Speech bubble anchor point (positioned above the maid's head)
    this.speechAnchor = new Container({
      x: 0,
      y: -52,
      label: 'speech-anchor',
    });
    this.addChild(this.speechAnchor);

    // Interaction setup
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', (e) => {
      e.stopPropagation();
      this.handlePointerClick();
    });

    this.setState('idle', this.currentDirection);
    this.updateZIndex();
  }

  /**
   * Sets the bounds for autonomous wandering within the estate.
   */
  public setWanderBounds(minX: number, maxX: number, minY: number, maxY: number): void {
    this.wanderBounds = { minX, maxX, minY, maxY };
    this.aiTimer = 1.0 + Math.random() * 2.0;
  }

  /**
   * Register a custom click reaction handler.
   */
  public setClickHandler(cb: () => void): void {
    this.onClickCallback = cb;
  }

  /**
   * Sets character state and direction, updating texture frames.
   */
  public setState(state: MaidState, direction?: MaidDirection): void {
    this.currentState = state;
    if (direction) {
      this.currentDirection = direction;
    }

    if (state === 'idle') {
      this.animSprite.stop();
      if (this.currentDirection === 'down') {
        this.animSprite.textures = [this.frames.down.idle];
        this.animSprite.scale.x = 1;
      } else if (this.currentDirection === 'up') {
        this.animSprite.textures = [this.frames.up.idle];
        this.animSprite.scale.x = 1;
      } else if (this.currentDirection === 'left') {
        this.animSprite.textures = [this.frames.left.idle];
        this.animSprite.scale.x = 1;
      } else if (this.currentDirection === 'right') {
        this.animSprite.textures = [this.frames.left.idle];
        this.animSprite.scale.x = -1; // Mirrored for right facing
      }
    } else if (state === 'walk') {
      this.animSprite.animationSpeed = 0.12;
      if (this.currentDirection === 'down') {
        this.animSprite.textures = this.frames.down.walk;
        this.animSprite.scale.x = 1;
      } else if (this.currentDirection === 'up') {
        this.animSprite.textures = this.frames.up.walk;
        this.animSprite.scale.x = 1;
      } else if (this.currentDirection === 'left') {
        this.animSprite.textures = this.frames.left.walk;
        this.animSprite.scale.x = 1;
      } else if (this.currentDirection === 'right') {
        this.animSprite.textures = this.frames.left.walk;
        this.animSprite.scale.x = -1;
      }
      this.animSprite.play();
    } else if (state === 'chore') {
      // Action row: Fifi sweeping / Nyah bossy stance
      this.animSprite.textures = this.frames.action;
      this.animSprite.scale.x = 1;
      this.animSprite.animationSpeed = this.maidName === 'fifi' ? 0.14 : 0.09;
      this.animSprite.play();
    }
  }

  /**
   * Commands the maid to walk to target world coordinates.
   */
  public moveTo(x: number, y: number): void {
    this.moveTarget = new Point(Math.round(x), Math.round(y));
    const dx = this.moveTarget.x - this.x;
    const dy = this.moveTarget.y - this.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.setState('walk', dx > 0 ? 'right' : 'left');
    } else {
      this.setState('walk', dy > 0 ? 'down' : 'up');
    }
  }

  /**
   * Returns speech bubble world position for overworld dialogue balloons.
   */
  public getSpeechAnchorWorld(): { x: number; y: number } {
    const globalPos = this.toGlobal(this.speechAnchor.position);
    return { x: Math.round(globalPos.x), y: Math.round(globalPos.y) };
  }

  /**
   * Handles user interaction clicking on the maid.
   */
  private handlePointerClick(): void {
    // Face player
    this.setState('chore', 'down');
    this.aiTimer = 2.5;

    if (this.onClickCallback) {
      this.onClickCallback();
    }
  }

  /**
   * Synchronizes depth sorting zIndex with integer Y position.
   */
  private updateZIndex(): void {
    this.zIndex = Math.floor(this.y);
  }

  /**
   * Frame update loop called by world ticker.
   */
  public update(deltaSeconds: number): void {
    // Safety boundary clamping: prevent maid from ever slipping behind house or out of bounds
    if (this.wanderBounds) {
      if (this.y < this.wanderBounds.minY) {
        this.y = this.wanderBounds.minY;
        this.moveTarget = null;
        this.setState('chore');
      } else if (this.y > this.wanderBounds.maxY) {
        this.y = this.wanderBounds.maxY;
        this.moveTarget = null;
        this.setState('chore');
      }
    }

    if (this.moveTarget) {
      const dx = this.moveTarget.x - this.x;
      const dy = this.moveTarget.y - this.y;
      const dist = Math.hypot(dx, dy);
      const step = this.walkSpeed * deltaSeconds;

      if (dist <= step || dist < 2) {
        this.x = this.moveTarget.x;
        this.y = this.moveTarget.y;
        this.moveTarget = null;
        this.consecutiveCollisions = 0;
        // On arrival, perform chore
        this.setState('chore');
        this.aiTimer = 2.0 + Math.random() * 3.0;
      } else {
        const targetX = this.x + (dx / dist) * step;
        const targetY = this.y + (dy / dist) * step;

        // Closed-Loop Navigation: test unified predicate and slide or halt upon collision
        if (!this.isWalkable || this.isWalkable(targetX, targetY, 8)) {
          this.x = targetX;
          this.y = targetY;
          this.consecutiveCollisions = 0;
        } else if (this.isWalkable(targetX, this.y, 8)) {
          // Slide along X axis
          this.x = targetX;
          this.consecutiveCollisions = 0;
        } else if (this.isWalkable(this.x, targetY, 8)) {
          // Slide along Y axis
          this.y = targetY;
          this.consecutiveCollisions = 0;
        } else {
          // Obstacle collision! Stop moving and switch to chore
          this.consecutiveCollisions++;
          this.moveTarget = null;
          this.setState('chore');
          this.aiTimer = 1.0 + Math.random() * 1.5;

          // If trapped or colliding repeatedly, recover towards open center of bounds
          if (this.consecutiveCollisions >= 3 && this.wanderBounds) {
            const centerX = Math.round((this.wanderBounds.minX + this.wanderBounds.maxX) / 2);
            const centerY = Math.round((this.wanderBounds.minY + this.wanderBounds.maxY) / 2);
            this.moveTo(centerX, centerY);
            this.consecutiveCollisions = 0;
          }

          this.updateZIndex();
          return;
        }

        // Update direction while moving
        if (Math.abs(dx) > Math.abs(dy)) {
          const dir = dx > 0 ? 'right' : 'left';
          if (dir !== this.currentDirection) this.setState('walk', dir);
        } else {
          const dir = dy > 0 ? 'down' : 'up';
          if (dir !== this.currentDirection) this.setState('walk', dir);
        }
      }
      this.updateZIndex();
      return;
    }

    // Autonomous AI state transitions
    if (this.wanderBounds) {
      this.aiTimer -= deltaSeconds;
      if (this.aiTimer <= 0) {
        if (this.currentState === 'chore' || this.currentState === 'idle') {
          // Pick a new target in bounds to walk to that is walkable
          let targetX = this.x;
          let targetY = this.y;
          let found = false;
          for (let attempt = 0; attempt < 10; attempt++) {
            const tx = Math.round(
              this.wanderBounds.minX + Math.random() * (this.wanderBounds.maxX - this.wanderBounds.minX)
            );
            const ty = Math.round(
              this.wanderBounds.minY + Math.random() * (this.wanderBounds.maxY - this.wanderBounds.minY)
            );
            if (!this.isWalkable || this.isWalkable(tx, ty, 8)) {
              targetX = tx;
              targetY = ty;
              found = true;
              break;
            }
          }
          if (found) {
            this.moveTo(targetX, targetY);
          } else {
            this.setState('chore');
            this.aiTimer = 2.0 + Math.random() * 2.0;
          }
        } else {
          // Switch to chore
          this.setState('chore');
          this.aiTimer = 2.0 + Math.random() * 3.5;
        }
      }
    }

    this.updateZIndex();
  }
}
