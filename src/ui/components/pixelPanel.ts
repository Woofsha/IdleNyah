// src/ui/components/pixelPanel.ts
import { Container, Graphics } from 'pixi.js';

export interface PixelPanelOptions {
  width: number;
  height: number;
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeWidth?: number;
  radius?: number;
  innerBorder?: boolean;
}

export class PixelPanel extends Container {
  private panelWidth: number;
  private panelHeight: number;
  private fillColor: number;
  private fillAlpha: number;
  private strokeColor: number;
  private strokeWidth: number;
  private radius: number;
  private innerBorder: boolean;

  private bgGraphics: Graphics;

  constructor(options: PixelPanelOptions) {
    super();
    this.panelWidth = options.width;
    this.panelHeight = options.height;
    this.fillColor = options.fillColor ?? 0x120d20;
    this.fillAlpha = options.fillAlpha ?? 0.88;
    this.strokeColor = options.strokeColor ?? 0x854d0e;
    this.strokeWidth = options.strokeWidth ?? 1.5;
    this.radius = options.radius ?? 8;
    this.innerBorder = Boolean(options.innerBorder);

    this.bgGraphics = new Graphics();
    this.addChild(this.bgGraphics);
    this.redraw();
  }

  public resize(width: number, height: number): void {
    if (this.panelWidth !== width || this.panelHeight !== height) {
      this.panelWidth = width;
      this.panelHeight = height;
      this.redraw();
    }
  }

  public redraw(): void {
    const g = this.bgGraphics;
    g.clear();

    const w = this.panelWidth;
    const h = this.panelHeight;

    // Main frame: PixiJS v8 shape-then-fill with translucent glass
    g.roundRect(0, 0, w, h, this.radius);
    g.fill({ color: this.fillColor, alpha: this.fillAlpha });
    g.stroke({ color: this.strokeColor, width: this.strokeWidth });

    // Subtle 1px warm upper rim highlight
    if (w > 16 && h > 8) {
      g.roundRect(1, 1, w - 2, Math.min(12, h - 2), Math.max(1, this.radius - 1));
      g.stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
    }

    // Optional inner decorative border
    if (this.innerBorder && w > 12 && h > 12) {
      g.roundRect(4, 4, w - 8, h - 8, Math.max(1, this.radius - 2));
      g.stroke({ color: this.strokeColor, width: 1, alpha: 0.35 });
    }
  }
}
