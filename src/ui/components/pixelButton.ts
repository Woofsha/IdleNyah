// src/ui/components/pixelButton.ts
import { Container, Graphics, Rectangle, Text, TextStyle } from 'pixi.js';

export interface PixelButtonOptions {
  width: number;
  height: number;
  text: string;
  subText?: string;
  onClick: () => void;
  variant?: 'gold' | 'purple' | 'green' | 'default' | 'pill';
  disabled?: boolean;
  selected?: boolean;
  fontSize?: number;
  subFontSize?: number;
}

export class PixelButton extends Container {
  private btnWidth: number;
  private btnHeight: number;
  private btnText: string;
  private btnSubText?: string;
  private onClickHandler: () => void;
  private variant: 'gold' | 'purple' | 'green' | 'default' | 'pill';
  private disabled = false;
  private selected = false;
  private isHovered = false;
  private isPressed = false;

  private bgGraphics: Graphics;
  private contentContainer: Container;
  private labelText: Text;
  private subLabelText?: Text;

  constructor(options: PixelButtonOptions) {
    super();
    this.btnWidth = options.width;
    this.btnHeight = options.height;
    this.btnText = options.text;
    this.btnSubText = options.subText;
    this.onClickHandler = options.onClick;
    this.variant = options.variant ?? 'default';
    this.disabled = Boolean(options.disabled);
    this.selected = Boolean(options.selected);

    this.eventMode = 'static';
    this.cursor = this.disabled ? 'not-allowed' : 'pointer';
    this.hitArea = new Rectangle(0, 0, this.btnWidth, this.btnHeight);

    this.bgGraphics = new Graphics();
    this.addChild(this.bgGraphics);

    this.contentContainer = new Container();
    this.addChild(this.contentContainer);

    const fSize = options.fontSize ?? (options.subText ? 10 : 11);
    this.labelText = new Text({
      text: this.btnText,
      style: new TextStyle({
        fontFamily: '"Silkscreen", "Courier New", monospace',
        fontSize: fSize,
        fontWeight: 'bold',
        fill: '#ffffff',
        align: 'center',
        stroke: { color: 0x0c0a18, width: 2 },
      }),
    });
    this.labelText.anchor.set(0.5, options.subText ? 0.35 : 0.5);
    this.labelText.position.set(Math.floor(this.btnWidth / 2), Math.floor(this.btnHeight / (options.subText ? 3 : 2)));
    this.contentContainer.addChild(this.labelText);

    if (this.btnSubText) {
      const subFSize = options.subFontSize ?? 9;
      this.subLabelText = new Text({
        text: this.btnSubText,
        style: new TextStyle({
          fontFamily: '"Silkscreen", "Courier New", monospace',
          fontSize: subFSize,
          fill: '#ffd54f',
          align: 'center',
          stroke: { color: 0x0c0a18, width: 2 },
        }),
      });
      this.subLabelText.anchor.set(0.5, 0.5);
      this.subLabelText.position.set(
        Math.floor(this.btnWidth / 2),
        Math.floor((this.btnHeight * 2.3) / 3.3),
      );
      this.contentContainer.addChild(this.subLabelText);
    }

    this.setupEvents();
    this.redraw();
  }

  private setupEvents(): void {
    this.on('pointerover', () => {
      if (this.disabled) return;
      this.isHovered = true;
      this.redraw();
    });

    this.on('pointerout', () => {
      this.isHovered = false;
      this.isPressed = false;
      this.contentContainer.position.y = 0;
      this.redraw();
    });

    this.on('pointerdown', (e) => {
      if (this.disabled) return;
      e.stopPropagation();
      this.isPressed = true;
      this.contentContainer.position.y = 1;
      this.redraw();
      this.onClickHandler();
    });

    this.on('pointerup', () => {
      this.isPressed = false;
      this.contentContainer.position.y = 0;
      this.redraw();
    });

    this.on('pointerupoutside', () => {
      this.isPressed = false;
      this.contentContainer.position.y = 0;
      this.redraw();
    });
  }

  public setText(text: string, subText?: string): void {
    if (this.btnText !== text || this.btnSubText !== subText) {
      this.btnText = text;
      this.btnSubText = subText;
      this.labelText.text = text;
      if (this.subLabelText) {
        if (subText !== undefined) {
          this.subLabelText.text = subText;
          this.subLabelText.visible = true;
        } else {
          this.subLabelText.visible = false;
        }
      }
    }
  }

  public setDisabled(disabled: boolean): void {
    if (this.disabled !== disabled) {
      this.disabled = disabled;
      this.cursor = disabled ? 'not-allowed' : 'pointer';
      this.redraw();
    }
  }

  public setSelected(selected: boolean): void {
    if (this.selected !== selected) {
      this.selected = selected;
      this.redraw();
    }
  }

  public redraw(): void {
    const g = this.bgGraphics;
    g.clear();

    const w = this.btnWidth;
    const h = this.btnHeight;
    const radius = this.variant === 'pill' ? Math.floor(h / 2) : 6;

    // Palette configs for Painterly 2.5D Diorama
    let fillColor = 0x181226;
    let strokeColor = 0x503a6e;
    let textColor = '#e2e8f0';

    if (this.disabled) {
      fillColor = 0x120e1e;
      strokeColor = 0x2c223d;
      textColor = '#64748b';
    } else if (this.selected) {
      fillColor = 0x5c2f0d; // warm amber core
      strokeColor = 0xfbbf24; // emissive golden rim
      textColor = '#fffbeb';
    } else {
      switch (this.variant) {
        case 'gold':
          fillColor = this.isHovered ? 0x4a2a12 : 0x361d0a;
          strokeColor = this.isHovered ? 0xf59e0b : 0x854d0e;
          textColor = '#fef3c7';
          break;
        case 'purple':
          fillColor = this.isHovered ? 0x2e1f44 : 0x1e1430;
          strokeColor = this.isHovered ? 0x854d0e : 0x4a3766;
          textColor = '#e2e8f0';
          break;
        case 'green':
          fillColor = this.isHovered ? 0x1e4624 : 0x143319;
          strokeColor = this.isHovered ? 0x4ade80 : 0x22c55e;
          textColor = '#f0fdf4';
          break;
        case 'pill':
        case 'default':
        default:
          fillColor = this.isHovered ? 0x261d38 : 0x1a1228;
          strokeColor = this.isHovered ? 0x854d0e : 0x47365f;
          textColor = '#e2e8f0';
          break;
      }
    }

    if (this.isPressed && !this.disabled) {
      fillColor = Math.max(0, fillColor - 0x111111);
    }

    // PixiJS v8 shape-then-fill with translucent glass pill
    g.roundRect(0, 0, w, h, radius);
    g.fill({ color: fillColor, alpha: this.disabled ? 0.55 : 0.88 });
    g.stroke({ color: strokeColor, width: this.selected ? 2 : 1.2 });

    // Subtle 1px warm upper rim highlight
    if (!this.disabled && !this.isPressed && w > 8 && h > 4) {
      g.moveTo(radius > 4 ? 4 : 2, 1).lineTo(w - (radius > 4 ? 4 : 2), 1);
      g.stroke({ color: 0xffffff, width: 1, alpha: this.selected ? 0.25 : 0.1 });
    }

    this.labelText.style.fill = textColor;
    if (this.subLabelText) {
      this.subLabelText.style.fill = this.disabled ? '#6d6585' : '#ffd54f';
    }
  }
}
