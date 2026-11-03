// src/ui/speechBubble.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export interface SpeechBubbleOptions {
  speaker: 'nyah' | 'fifi';
  getAnchorPos: () => { x: number; y: number };
}

export class SpeechBubble extends Container {
  public speaker: 'nyah' | 'fifi';
  private getAnchorPos: () => { x: number; y: number };

  private bubbleGraphics: Graphics;
  private messageText: Text;
  private bubbleWidth = 200;
  private bubbleHeight = 44;

  private lifeTimer = 0;
  private maxLife = 3.5;
  private fadeTimer = 0;
  private isFadingOut = false;

  constructor(options: SpeechBubbleOptions) {
    super();
    this.speaker = options.speaker;
    this.getAnchorPos = options.getAnchorPos;

    this.visible = false;
    this.alpha = 0;

    this.bubbleGraphics = new Graphics();
    this.addChild(this.bubbleGraphics);

    this.messageText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: '"Silkscreen", "Courier New", monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: '#f5f0ff',
        wordWrap: true,
        wordWrapWidth: 180,
        lineHeight: 14,
        align: 'center',
        stroke: { color: 0x070511, width: 2 },
      }),
    });
    this.messageText.anchor.set(0.5, 0.5);
    this.addChild(this.messageText);
  }

  public show(text: string, duration = 3.5): void {
    this.messageText.text = text;
    this.maxLife = duration;
    this.lifeTimer = 0;
    this.fadeTimer = 0;
    this.isFadingOut = false;
    this.visible = true;
    this.alpha = 1;

    // Measure text and fit bubble
    const padX = 20;
    const padY = 16;
    this.bubbleWidth = Math.max(140, Math.min(240, Math.round(this.messageText.width + padX)));
    this.bubbleHeight = Math.max(38, Math.round(this.messageText.height + padY));

    this.redraw();
    this.updatePosition();
  }

  public hide(): void {
    this.visible = false;
    this.alpha = 0;
    this.lifeTimer = this.maxLife;
  }

  private redraw(): void {
    const g = this.bubbleGraphics;
    g.clear();

    const w = this.bubbleWidth;
    const h = this.bubbleHeight;
    const halfW = Math.floor(w / 2);
    const borderColor = this.speaker === 'nyah' ? 0x8e44ad : 0xa66c38;

    // Rounded rectangle bubble centered at x = 0, above y = 0
    // Bubble box: [-halfW, -h - 8, w, h]
    g.roundRect(-halfW, -h - 8, w, h, 6);
    g.fill({ color: 0x161324, alpha: 0.94 });
    g.stroke({ color: borderColor, width: 2 });

    // Downward tail pointing to anchor (0, 0)
    g.poly([
      -6, -8,
      0, 0,
      6, -8,
    ], true);
    g.fill({ color: 0x161324, alpha: 0.94 });
    g.stroke({ color: borderColor, width: 2 });

    // Position text inside box
    this.messageText.position.set(0, -Math.floor(h / 2) - 8);
  }

  private updatePosition(): void {
    const anchor = this.getAnchorPos();
    // Screen clamping: keep bubble box [-halfW, halfW] between 10 and 950
    const halfW = Math.floor(this.bubbleWidth / 2);
    const clampedX = Math.max(halfW + 10, Math.min(950 - halfW, anchor.x));
    const clampedY = Math.max(this.bubbleHeight + 16, anchor.y);

    this.position.set(clampedX, clampedY);
  }

  public update(deltaSeconds: number): void {
    if (!this.visible) return;

    this.updatePosition();

    this.lifeTimer += deltaSeconds;
    if (this.lifeTimer < 0.15) {
      // Fade in
      this.alpha = Math.min(1, this.lifeTimer / 0.15);
    } else if (this.lifeTimer >= this.maxLife) {
      // Fade out
      this.fadeTimer += deltaSeconds;
      this.alpha = Math.max(0, 1 - this.fadeTimer / 0.25);
      if (this.fadeTimer >= 0.25) {
        this.hide();
      }
    }
  }
}
