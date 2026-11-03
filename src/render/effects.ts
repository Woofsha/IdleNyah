// src/render/effects.ts
import { Container, Text, TextStyle, Graphics } from 'pixi.js';

export interface FloatingTextOptions {
  text: string;
  x: number;
  y: number;
  color?: string | number;
  fontSize?: number;
  isCrit?: boolean;
}

export interface SparkleOptions {
  x: number;
  y: number;
  count?: number;
  color?: number;
}

interface ActiveEffect {
  displayObject: Container;
  lifetime: number;
  maxLifetime: number;
  vx: number;
  vy: number;
  gravity?: number;
  onUpdate?: (progress: number, deltaSeconds: number) => void;
}

/**
 * Manages floating numbers, critical hit text, and pixel click sparkles.
 */
export class EffectsManager {
  public readonly container: Container;
  private activeEffects: ActiveEffect[] = [];

  constructor() {
    this.container = new Container({
      label: 'effects-layer',
      sortableChildren: false,
    });
  }

  /**
   * Spawns a floating currency or milestone text popup.
   */
  public spawnFloatingText(options: FloatingTextOptions): void {
    const isCrit = options.isCrit ?? false;
    const style = new TextStyle({
      fontFamily: '"Silkscreen", "Courier New", monospace',
      fontSize: options.fontSize ?? (isCrit ? 18 : 13),
      fontWeight: 'bold',
      fill: options.color ?? (isCrit ? '#ffd45e' : '#fef08a'),
      stroke: { color: 0x070511, width: 2.5 },
    });

    const textObj = new Text({
      text: options.text,
      style,
      roundPixels: true,
    });
    textObj.anchor.set(0.5, 0.5);
    textObj.x = options.x;
    textObj.y = options.y;

    this.container.addChild(textObj);

    this.activeEffects.push({
      displayObject: textObj,
      lifetime: 0,
      maxLifetime: isCrit ? 1.2 : 0.85,
      vx: (Math.random() - 0.5) * 20,
      vy: isCrit ? -60 : -45,
      onUpdate: (progress) => {
        // Fade out during last 40% of lifetime
        if (progress > 0.6) {
          textObj.alpha = 1 - (progress - 0.6) / 0.4;
        }
        if (isCrit) {
          // Subtle pulse
          const scale = 1 + Math.sin(progress * Math.PI) * 0.3;
          textObj.scale.set(scale);
        }
      },
    });
  }

  /**
   * Spawns a burst of retro pixel stars around click location.
   */
  public spawnSparkles(options: SparkleOptions): void {
    const count = options.count ?? 6;
    const colors = [0xfbbf24, 0xfde047, 0xf59e0b, 0xfffbeb, 0xc084fc];

    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const color = options.color ?? colors[Math.floor(Math.random() * colors.length)];
      const size = 3 + Math.floor(Math.random() * 3);

      g.rect(-size / 2, -size / 2, size, size);
      g.fill({ color });
      g.x = options.x + (Math.random() - 0.5) * 8;
      g.y = options.y + (Math.random() - 0.5) * 8;

      this.container.addChild(g);

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 40 + Math.random() * 60;

      this.activeEffects.push({
        displayObject: g,
        lifetime: 0,
        maxLifetime: 0.45 + Math.random() * 0.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 120, // gravity pulls sparkles down
        onUpdate: (progress) => {
          g.alpha = 1 - progress;
          g.scale.set(1 - progress * 0.5);
        },
      });
    }
  }

  /**
   * Updates all active particle effects and removes expired ones.
   */
  public update(deltaSeconds: number): void {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.lifetime += deltaSeconds;

      if (effect.lifetime >= effect.maxLifetime) {
        this.container.removeChild(effect.displayObject);
        effect.displayObject.destroy({ children: true });
        this.activeEffects.splice(i, 1);
        continue;
      }

      const progress = effect.lifetime / effect.maxLifetime;
      effect.displayObject.x += effect.vx * deltaSeconds;
      effect.displayObject.y += effect.vy * deltaSeconds;

      if (effect.gravity) {
        effect.vy += effect.gravity * deltaSeconds;
      }

      if (effect.onUpdate) {
        effect.onUpdate(progress, deltaSeconds);
      }
    }
  }

  /**
   * Cleans up all active effects.
   */
  public clear(): void {
    for (const effect of this.activeEffects) {
      this.container.removeChild(effect.displayObject);
      effect.displayObject.destroy({ children: true });
    }
    this.activeEffects = [];
  }
}
