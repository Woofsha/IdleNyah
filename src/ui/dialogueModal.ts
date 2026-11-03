// src/ui/dialogueModal.ts
import { Container, Graphics, Rectangle, Sprite, Text, TextStyle, type Texture } from 'pixi.js';
import type { DialogueLine, StoryModalSequence, UiCallbacks } from './types';
import { PixelButton } from './components/pixelButton';
import { PixelPanel } from './components/pixelPanel';

export interface StoryModalOptions {
  nyahPortrait: Texture;
  fifiPortrait: Texture;
  callbacks?: UiCallbacks;
}

export class StoryModal extends Container {
  private nyahPortrait: Texture;
  private fifiPortrait: Texture;
  private callbacks: UiCallbacks;

  private backdrop: Graphics;
  private dialogFrame: PixelPanel;
  private portraitFrame: PixelPanel;
  private portraitSprite: Sprite;

  private nameplateBg: Graphics;
  private nameplateText: Text;
  private bodyText: Text;

  private nextBtn: PixelButton;
  private closeBtn: PixelButton;

  private currentSequence: StoryModalSequence | null = null;
  private currentLineIndex = 0;
  private fullLineText = '';
  private displayedCharCount = 0;
  private typeTimer = 0;
  private isTyping = false;
  private onCompleteCallback?: () => void;

  constructor(options: StoryModalOptions) {
    super();
    this.nyahPortrait = options.nyahPortrait;
    this.fifiPortrait = options.fifiPortrait;
    this.callbacks = options.callbacks ?? {};

    this.visible = false;
    this.eventMode = 'static';

    // 1. Fullscreen Dimmed Backdrop (960x640)
    this.backdrop = new Graphics();
    this.backdrop.rect(0, 0, 960, 640);
    this.backdrop.fill({ color: 0x070511, alpha: 0.82 });
    this.backdrop.eventMode = 'static';
    this.backdrop.hitArea = new Rectangle(0, 0, 960, 640);
    this.backdrop.on('pointerdown', (e) => {
      e.stopPropagation();
      this.handleBoxClick();
    });
    this.addChild(this.backdrop);

    // 2. Dialogue Box (width 880, height 264, x = 40, y = 350)
    const boxContainer = new Container();
    boxContainer.position.set(40, 350);
    this.addChild(boxContainer);

    this.dialogFrame = new PixelPanel({
      width: 880,
      height: 264,
      fillColor: 0x161326,
      strokeColor: 0x5a4878,
      strokeWidth: 2,
      radius: 6,
      innerBorder: true,
    });
    boxContainer.addChild(this.dialogFrame);

    // 3. Portrait Frame on Left (x = 16, y = 16, width 308, height 232)
    // Perfectly fits 300x224 (4:3 ratio) native pixel art portraits
    this.portraitFrame = new PixelPanel({
      width: 308,
      height: 232,
      fillColor: 0x100d1c,
      strokeColor: 0xdfb448,
      strokeWidth: 2,
      radius: 4,
    });
    this.portraitFrame.position.set(16, 16);
    boxContainer.addChild(this.portraitFrame);

    this.portraitSprite = new Sprite(this.nyahPortrait);
    this.portraitSprite.width = 300;
    this.portraitSprite.height = 224;
    this.portraitSprite.position.set(20, 20);
    boxContainer.addChild(this.portraitSprite);

    // 4. Nameplate Pill (x = 340, y = 16)
    this.nameplateBg = new Graphics();
    this.nameplateBg.roundRect(0, 0, 260, 26, 4);
    this.nameplateBg.fill({ color: 0x4a2a6e, alpha: 0.95 });
    this.nameplateBg.stroke({ color: 0xdfb448, width: 1 });
    this.nameplateBg.position.set(340, 16);
    boxContainer.addChild(this.nameplateBg);

    this.nameplateText = new Text({
      text: 'Miss Nyah [Head Maid]',
      style: new TextStyle({
        fontFamily: '"Silkscreen", "Courier New", monospace',
        fontSize: 11,
        fontWeight: 'bold',
        fill: '#ffffff',
        stroke: { color: 0x070511, width: 2 },
      }),
      x: 352,
      y: 21,
    });
    boxContainer.addChild(this.nameplateText);

    // 5. Dialogue Body Text (x = 344, y = 54, width = 510)
    this.bodyText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: '"Silkscreen", "Courier New", monospace',
        fontSize: 11,
        fill: '#fcf8ec',
        wordWrap: true,
        wordWrapWidth: 510,
        lineHeight: 18,
        stroke: { color: 0x070511, width: 2 },
      }),
      x: 344,
      y: 54,
    });
    boxContainer.addChild(this.bodyText);

    // 6. Action Buttons at bottom right
    this.closeBtn = new PixelButton({
      width: 100,
      height: 32,
      text: 'Skip',
      variant: 'default',
      fontSize: 11,
      onClick: () => {
        this.close();
      },
    });
    this.closeBtn.position.set(620, 216);
    boxContainer.addChild(this.closeBtn);

    this.nextBtn = new PixelButton({
      width: 120,
      height: 32,
      text: 'Next >',
      variant: 'gold',
      fontSize: 11,
      onClick: () => {
        this.handleNext();
      },
    });
    this.nextBtn.position.set(736, 216);
    boxContainer.addChild(this.nextBtn);
  }

  public playSequence(sequence: StoryModalSequence, onComplete?: () => void): void {
    this.currentSequence = sequence;
    this.currentLineIndex = 0;
    this.onCompleteCallback = onComplete;
    this.visible = true;
    this.displayCurrentLine();
  }

  public isShowing(): boolean {
    return this.visible;
  }

  private displayCurrentLine(): void {
    if (!this.currentSequence) return;
    const line: DialogueLine | undefined = this.currentSequence.lines[this.currentLineIndex];
    if (!line) {
      this.close();
      return;
    }

    // Set portrait
    if (line.portrait === 'fifi_native') {
      this.portraitSprite.texture = this.fifiPortrait;
      this.nameplateBg.clear();
      this.nameplateBg.roundRect(0, 0, 260, 26, 4);
      this.nameplateBg.fill({ color: 0x5e3a20, alpha: 0.95 });
      this.nameplateBg.stroke({ color: 0xdfb448, width: 1 });
    } else {
      this.portraitSprite.texture = this.nyahPortrait;
      this.nameplateBg.clear();
      this.nameplateBg.roundRect(0, 0, 260, 26, 4);
      this.nameplateBg.fill({ color: 0x4a2a6e, alpha: 0.95 });
      this.nameplateBg.stroke({ color: 0xdfb448, width: 1 });
    }

    this.nameplateText.text = line.speakerName;
    this.fullLineText = line.text;
    this.displayedCharCount = 0;
    this.typeTimer = 0;
    this.isTyping = true;
    this.bodyText.text = '';

    const isLast = this.currentLineIndex === this.currentSequence.lines.length - 1;
    this.nextBtn.setText(isLast ? 'Close [X]' : 'Next >');
  }

  private handleBoxClick(): void {
    if (this.isTyping) {
      // Instantly finish typewriter
      this.finishTypewriter();
    } else {
      this.handleNext();
    }
  }

  private finishTypewriter(): void {
    this.isTyping = false;
    this.displayedCharCount = this.fullLineText.length;
    this.bodyText.text = this.fullLineText;
  }

  private handleNext(): void {
    this.callbacks.playSfx?.('click');
    if (this.isTyping) {
      this.finishTypewriter();
      return;
    }

    if (!this.currentSequence) return;
    this.currentLineIndex++;
    if (this.currentLineIndex < this.currentSequence.lines.length) {
      this.displayCurrentLine();
    } else {
      this.close();
    }
  }

  public close(): void {
    this.callbacks.playSfx?.('click');
    this.visible = false;
    this.currentSequence = null;
    const cb = this.onCompleteCallback;
    this.onCompleteCallback = undefined;
    cb?.();
  }

  public update(deltaSeconds: number): void {
    if (!this.visible || !this.isTyping) return;

    this.typeTimer += deltaSeconds;
    // 40 characters per second
    const charsToType = Math.floor(this.typeTimer * 40);
    if (charsToType > this.displayedCharCount) {
      this.displayedCharCount = Math.min(this.fullLineText.length, charsToType);
      this.bodyText.text = this.fullLineText.slice(0, this.displayedCharCount);

      if (this.displayedCharCount >= this.fullLineText.length) {
        this.isTyping = false;
      }
    }
  }
}
