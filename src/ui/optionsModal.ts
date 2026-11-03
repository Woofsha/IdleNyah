// src/ui/optionsModal.ts
/**
 * In-Game Options Modal for IdleNyah.
 * Provides Sound and Graphics configuration tabs, retro pixel aesthetic,
 * Return to Main Menu navigation, and headless Vitest compatibility.
 */

import type { AudioEngineSettings, IAudioEngine } from '../audio/types';

export interface GraphicsSettings {
  fullscreen: boolean;
  windSway: boolean;
  ambientFireflies: boolean;
  vignette: boolean;
}

export interface OptionsModalOptions {
  container?: HTMLElement | null;
  audio?: IAudioEngine;
  initialSound?: Partial<AudioEngineSettings>;
  initialGraphics?: Partial<GraphicsSettings>;
  onReturnToMainMenu?: () => void;
  onReturnToMenu?: () => void;
  onMainMenu?: () => void;
  onClose?: () => void;
  onVolumeChange?: (type: 'master' | 'bgm' | 'sfx', volume: number) => void;
  onMuteToggle?: (muted: boolean) => void;
  onSoundChange?: (settings: AudioEngineSettings) => void;
  onGraphicsChange?: (settings: GraphicsSettings) => void;
  onToggleFullscreen?: () => void;
  onToggleWindSway?: (enabled: boolean) => void;
  onToggleFireflies?: (enabled: boolean) => void;
  onToggleVignette?: (enabled: boolean) => void;
}

export class OptionsModal {
  public isVisible = false;
  public activeTab: 'sound' | 'graphics' = 'sound';

  public container: HTMLElement | null = null;
  public modalElement: HTMLElement | null = null;

  private options: OptionsModalOptions;
  private audio?: IAudioEngine;

  private soundSettings: AudioEngineSettings = {
    masterVolume: 1.0,
    bgmVolume: 0.8,
    sfxVolume: 1.0,
    muted: false,
  };

  private graphicsSettings: GraphicsSettings = {
    fullscreen: false,
    windSway: true,
    ambientFireflies: true,
    vignette: true,
  };

  // DOM element references
  private tabSoundBtn: HTMLButtonElement | null = null;
  private tabGraphicsBtn: HTMLButtonElement | null = null;
  private soundContent: HTMLElement | null = null;
  private graphicsContent: HTMLElement | null = null;

  private masterValText: HTMLElement | null = null;
  private masterSlider: HTMLInputElement | null = null;
  private bgmValText: HTMLElement | null = null;
  private bgmSlider: HTMLInputElement | null = null;
  private sfxValText: HTMLElement | null = null;
  private sfxSlider: HTMLInputElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;

  private fullscreenBtn: HTMLButtonElement | null = null;
  private windSwayBtn: HTMLButtonElement | null = null;
  private firefliesBtn: HTMLButtonElement | null = null;
  private vignetteBtn: HTMLButtonElement | null = null;

  constructor(options: OptionsModalOptions = {}) {
    this.options = options;
    this.audio = options.audio;

    // Initialize sound settings from audio engine or defaults
    if (this.audio) {
      try {
        const currentAudio = this.audio.getSettings();
        this.soundSettings = {
          masterVolume: currentAudio.masterVolume,
          bgmVolume: currentAudio.bgmVolume,
          sfxVolume: currentAudio.sfxVolume,
          muted: currentAudio.muted,
        };
      } catch {
        // Fall back to defaults
      }
    }

    if (options.initialSound) {
      this.soundSettings = {
        ...this.soundSettings,
        ...options.initialSound,
      };
    }

    if (options.initialGraphics) {
      this.graphicsSettings = {
        ...this.graphicsSettings,
        ...options.initialGraphics,
      };
    }

    // Guard headless/Node.js environments without DOM or partial test mocks
    if (this.isFullDomAvailable()) {
      this.initDom();
    }
  }

  /**
   * Validates whether document and full DOM manipulation APIs are available.
   */
  private isFullDomAvailable(): boolean {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return false;
    }
    try {
      const testEl = document.createElement('div');
      return (
        typeof testEl.appendChild === 'function' &&
        typeof testEl.addEventListener === 'function'
      );
    } catch {
      return false;
    }
  }

  // =========================================================================
  // DOM Construction
  // =========================================================================
  private initDom(): void {
    this.container = this.options.container ?? (document.getElementById('app-container') || document.body || null);

    // 1. Root Modal Overlay
    this.modalElement = document.createElement('div');
    this.modalElement.id = 'options-modal-overlay';
    this.modalElement.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 180;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(7, 5, 17, 0.84);
      backdrop-filter: blur(2px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
      -webkit-user-select: none;
      padding: 16px;
      box-sizing: border-box;
    `;

    // Click backdrop to close
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.playSfx('click');
        this.hide();
        this.options.onClose?.();
      }
    });

    // 2. Center Card Panel
    const card = document.createElement('div');
    card.className = 'options-modal-card';
    card.style.cssText = `
      position: relative;
      width: 100%;
      max-width: 420px;
      background: rgba(20, 14, 34, 0.94);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 2px solid #854d0e;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(7, 5, 17, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      padding: 18px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-sizing: border-box;
      color: #f3e8ff;
      font-family: 'Silkscreen', 'Courier New', monospace;
    `;
    card.addEventListener('click', (e) => e.stopPropagation());

    // 3. Header: Title + Close Button [X]
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      border-bottom: 2px solid #36284e;
      padding-bottom: 8px;
    `;

    const title = document.createElement('div');
    title.id = 'options-modal-title';
    title.textContent = '⚙️ OPTIONS';
    title.style.cssText = `
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #ffd45e;
      text-shadow: 0 2px 0 #3a1a08, 0 0 10px rgba(251, 191, 36, 0.4);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.id = 'options-btn-close';
    closeBtn.className = 'options-btn';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close options modal');
    closeBtn.style.cssText = `
      width: 28px;
      height: 28px;
      font-size: 14px;
      padding: 0;
      color: #ffffff;
      background: linear-gradient(180deg, #ef4444 0%, #b91c1c 100%);
      border: 2px solid #ffffff;
      border-radius: 5px;
      box-shadow: 0 2px 0 #0f0b17;
      cursor: pointer;
    `;
    closeBtn.addEventListener('click', () => {
      this.playSfx('click');
      this.hide();
      this.options.onClose?.();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    card.appendChild(header);

    // 4. Tabs Navigation (Sound / Graphics)
    const tabsRow = document.createElement('div');
    tabsRow.style.cssText = `
      display: flex;
      gap: 8px;
      width: 100%;
    `;

    this.tabSoundBtn = this.createTabButton('🎵 SOUND', 'sound');
    this.tabSoundBtn.id = 'options-tab-sound';

    this.tabGraphicsBtn = this.createTabButton('🎨 GRAPHICS', 'graphics');
    this.tabGraphicsBtn.id = 'options-tab-graphics';

    tabsRow.appendChild(this.tabSoundBtn);
    tabsRow.appendChild(this.tabGraphicsBtn);
    card.appendChild(tabsRow);

    // 5. Tab Content Area
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
      display: flex;
      flex-direction: column;
      min-height: 200px;
    `;

    // Sound Content
    this.soundContent = document.createElement('div');
    this.soundContent.id = 'options-sound-content';
    this.soundContent.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    `;

    // Master Volume Row
    const masterRow = this.createVolumeRow(
      'Master Volume',
      'master',
      this.soundSettings.masterVolume,
      (val) => this.setMasterVolume(val)
    );
    this.masterValText = masterRow.valText;
    this.masterSlider = masterRow.slider;
    this.soundContent.appendChild(masterRow.rowEl);

    // BGM Volume Row
    const bgmRow = this.createVolumeRow(
      'BGM Volume',
      'bgm',
      this.soundSettings.bgmVolume,
      (val) => this.setBgmVolume(val)
    );
    this.bgmValText = bgmRow.valText;
    this.bgmSlider = bgmRow.slider;
    this.soundContent.appendChild(bgmRow.rowEl);

    // SFX Volume Row
    const sfxRow = this.createVolumeRow(
      'SFX Volume',
      'sfx',
      this.soundSettings.sfxVolume,
      (val) => this.setSfxVolume(val)
    );
    this.sfxValText = sfxRow.valText;
    this.sfxSlider = sfxRow.slider;
    this.soundContent.appendChild(sfxRow.rowEl);

    // Mute Toggle Button
    this.muteBtn = this.createRetroButton(
      this.soundSettings.muted ? '🔇 SOUND: MUTED' : '🔊 SOUND: ON',
      this.soundSettings.muted ? '#ef4444' : '#8b5cf6',
      this.soundSettings.muted ? '#b91c1c' : '#6d28d9',
      () => {
        this.toggleMute();
      }
    );
    this.muteBtn.id = 'options-btn-mute';
    this.soundContent.appendChild(this.muteBtn);

    // Graphics Content
    this.graphicsContent = document.createElement('div');
    this.graphicsContent.id = 'options-graphics-content';
    this.graphicsContent.style.cssText = `
      display: none;
      flex-direction: column;
      gap: 10px;
      width: 100%;
    `;

    // Fullscreen Toggle
    this.fullscreenBtn = this.createRetroButton(
      this.graphicsSettings.fullscreen ? '🖥️ FULLSCREEN: ON' : '🖥️ FULLSCREEN: OFF',
      this.graphicsSettings.fullscreen ? '#22c55e' : '#64748b',
      this.graphicsSettings.fullscreen ? '#15803d' : '#475569',
      () => {
        this.toggleFullscreen();
      }
    );
    this.fullscreenBtn.id = 'options-btn-fullscreen';
    this.graphicsContent.appendChild(this.fullscreenBtn);

    // Wind Sway Toggle
    this.windSwayBtn = this.createRetroButton(
      this.graphicsSettings.windSway ? '🍃 WIND SWAY: ON' : '🍃 WIND SWAY: OFF',
      this.graphicsSettings.windSway ? '#22c55e' : '#475569',
      this.graphicsSettings.windSway ? '#15803d' : '#334155',
      () => {
        this.toggleGraphicsOption('windSway');
      }
    );
    this.windSwayBtn.id = 'options-btn-wind-sway';
    this.graphicsContent.appendChild(this.windSwayBtn);

    // Ambient Fireflies Toggle
    this.firefliesBtn = this.createRetroButton(
      this.graphicsSettings.ambientFireflies ? '✨ FIREFLIES: ON' : '✨ FIREFLIES: OFF',
      this.graphicsSettings.ambientFireflies ? '#22c55e' : '#475569',
      this.graphicsSettings.ambientFireflies ? '#15803d' : '#334155',
      () => {
        this.toggleGraphicsOption('ambientFireflies');
      }
    );
    this.firefliesBtn.id = 'options-btn-fireflies';
    this.graphicsContent.appendChild(this.firefliesBtn);

    // Vignette Toggle
    this.vignetteBtn = this.createRetroButton(
      this.graphicsSettings.vignette ? '🎬 VIGNETTE: ON' : '🎬 VIGNETTE: OFF',
      this.graphicsSettings.vignette ? '#22c55e' : '#475569',
      this.graphicsSettings.vignette ? '#15803d' : '#334155',
      () => {
        this.toggleGraphicsOption('vignette');
      }
    );
    this.vignetteBtn.id = 'options-btn-vignette';
    this.graphicsContent.appendChild(this.vignetteBtn);

    contentArea.appendChild(this.soundContent);
    contentArea.appendChild(this.graphicsContent);
    card.appendChild(contentArea);

    // 6. Footer Actions (Return to Main Menu & Close)
    const footer = document.createElement('div');
    footer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      border-top: 2px solid #36284e;
      padding-top: 10px;
      margin-top: 2px;
    `;

    // Return to Main Menu
    const returnMainMenuBtn = this.createRetroButton(
      '🏠 RETURN TO MAIN MENU',
      '#eab308',
      '#ca8a04',
      () => {
        this.returnToMainMenu();
      }
    );
    returnMainMenuBtn.id = 'options-btn-main-menu';
    footer.appendChild(returnMainMenuBtn);

    // Bottom Close
    const bottomCloseBtn = this.createRetroButton(
      'CLOSE',
      '#a855f7',
      '#7e22ce',
      () => {
        this.playSfx('click');
        this.hide();
        this.options.onClose?.();
      }
    );
    bottomCloseBtn.id = 'options-btn-close-bottom';
    footer.appendChild(bottomCloseBtn);

    card.appendChild(footer);

    // 7. Stylesheet for buttons & sliders
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .options-btn {
        font-family: 'Silkscreen', 'Courier New', monospace;
        font-weight: bold;
        letter-spacing: 0.5px;
        border: 2px solid #ffffff;
        box-shadow: 0 3px 0 #0f0b17;
        cursor: pointer;
        text-shadow: 0 1px 0 #000000;
        outline: none;
        transition: transform 0.08s ease, filter 0.08s ease;
      }
      .options-btn:hover {
        transform: translateY(-2px);
        filter: brightness(1.15);
      }
      .options-btn:active {
        transform: translateY(1px);
        filter: brightness(0.95);
      }
      .options-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 8px;
        background: #0d0a17;
        border: 1px solid #5a4575;
        border-radius: 4px;
        outline: none;
        cursor: pointer;
      }
      .options-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 3px;
        background: #ffd45e;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 0 #070510;
        cursor: pointer;
      }
      .options-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        background: #ffd45e;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 0 #070510;
        cursor: pointer;
      }
    `;
    card.appendChild(styleEl);

    this.modalElement.appendChild(card);
    if (this.container && typeof this.container.appendChild === 'function') {
      this.container.appendChild(this.modalElement);
    }

    // Refresh UI states
    this.updateTabStyles();
    this.updateSoundDisplay();
    this.updateGraphicsDisplay();
  }

  // =========================================================================
  // Element Builders
  // =========================================================================
  private createTabButton(text: string, tab: 'sound' | 'graphics'): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'options-btn';
    btn.textContent = text;
    btn.style.cssText = `
      flex: 1;
      padding: 8px 10px;
      font-size: 11px;
      border-radius: 6px;
    `;
    btn.addEventListener('click', () => {
      this.playSfx('click');
      this.setTab(tab);
    });
    return btn;
  }

  private createRetroButton(
    text: string,
    topColor: string,
    baseColor: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'options-btn';
    btn.textContent = text;
    btn.style.cssText = `
      width: 100%;
      font-size: 11px;
      color: #ffffff;
      padding: 9px 12px;
      background: linear-gradient(180deg, ${topColor} 0%, ${baseColor} 100%);
      border-radius: 6px;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private createVolumeRow(
    label: string,
    type: 'master' | 'bgm' | 'sfx',
    initialVal: number,
    onChange: (val: number) => void
  ): { rowEl: HTMLElement; valText: HTMLElement; slider: HTMLInputElement } {
    const rowEl = document.createElement('div');
    rowEl.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
    `;

    const labelRow = document.createElement('div');
    labelRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #cfc9e2;
    `;

    const labelText = document.createElement('span');
    labelText.textContent = label;

    const valText = document.createElement('span');
    valText.id = `options-val-${type}`;
    valText.textContent = `${Math.round(initialVal * 100)}%`;
    valText.style.cssText = `
      font-weight: bold;
      color: #ffd45e;
    `;

    labelRow.appendChild(labelText);
    labelRow.appendChild(valText);
    rowEl.appendChild(labelRow);

    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    `;

    // Minus Button
    const minusBtn = document.createElement('button');
    minusBtn.id = `options-btn-${type}-minus`;
    minusBtn.className = 'options-btn';
    minusBtn.textContent = '-';
    minusBtn.style.cssText = `
      width: 26px;
      height: 26px;
      font-size: 14px;
      padding: 0;
      color: #ffffff;
      background: linear-gradient(180deg, #64748b 0%, #475569 100%);
      border-radius: 4px;
    `;
    minusBtn.addEventListener('click', () => {
      this.playSfx('click');
      const cur = type === 'master'
        ? this.soundSettings.masterVolume
        : type === 'bgm'
        ? this.soundSettings.bgmVolume
        : this.soundSettings.sfxVolume;
      const next = Math.max(0, Math.round((cur - 0.1) * 10) / 10);
      onChange(next);
    });

    // Slider
    const slider = document.createElement('input');
    slider.id = `options-slider-${type}`;
    slider.type = 'range';
    slider.className = 'options-slider';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(Math.round(initialVal * 100));
    slider.addEventListener('input', () => {
      const val = Math.min(1, Math.max(0, Number(slider.value) / 100));
      onChange(val);
    });

    // Plus Button
    const plusBtn = document.createElement('button');
    plusBtn.id = `options-btn-${type}-plus`;
    plusBtn.className = 'options-btn';
    plusBtn.textContent = '+';
    plusBtn.style.cssText = `
      width: 26px;
      height: 26px;
      font-size: 14px;
      padding: 0;
      color: #ffffff;
      background: linear-gradient(180deg, #64748b 0%, #475569 100%);
      border-radius: 4px;
    `;
    plusBtn.addEventListener('click', () => {
      this.playSfx('click');
      const cur = type === 'master'
        ? this.soundSettings.masterVolume
        : type === 'bgm'
        ? this.soundSettings.bgmVolume
        : this.soundSettings.sfxVolume;
      const next = Math.min(1, Math.round((cur + 0.1) * 10) / 10);
      onChange(next);
    });

    controlsRow.appendChild(minusBtn);
    controlsRow.appendChild(slider);
    controlsRow.appendChild(plusBtn);
    rowEl.appendChild(controlsRow);

    return { rowEl, valText, slider };
  }

  // =========================================================================
  // State Updaters & Public API
  // =========================================================================
  public show(tab?: 'sound' | 'graphics'): void {
    if (tab) {
      this.setTab(tab);
    }
    this.isVisible = true;

    // Check full screen status on show if possible
    if (typeof document !== 'undefined') {
      this.graphicsSettings.fullscreen = Boolean(document.fullscreenElement);
      this.updateGraphicsDisplay();
    }

    if (this.modalElement) {
      this.modalElement.style.opacity = '1';
      this.modalElement.style.pointerEvents = 'auto';
    }
  }

  public hide(): void {
    this.isVisible = false;
    if (this.modalElement) {
      this.modalElement.style.opacity = '0';
      this.modalElement.style.pointerEvents = 'none';
    }
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public setTab(tab: 'sound' | 'graphics'): void {
    this.activeTab = tab;
    this.updateTabStyles();
  }

  public getTab(): 'sound' | 'graphics' {
    return this.activeTab;
  }

  private updateTabStyles(): void {
    if (!this.tabSoundBtn || !this.tabGraphicsBtn) return;

    if (this.activeTab === 'sound') {
      this.tabSoundBtn.style.background = 'linear-gradient(180deg, #eab308 0%, #ca8a04 100%)';
      this.tabSoundBtn.style.border = '2px solid #ffffff';
      this.tabSoundBtn.style.boxShadow = '0 3px 0 #0f0b17';
      this.tabSoundBtn.style.color = '#ffffff';

      this.tabGraphicsBtn.style.background = 'linear-gradient(180deg, #382952 0%, #201533 100%)';
      this.tabGraphicsBtn.style.border = '2px solid #5a4575';
      this.tabGraphicsBtn.style.boxShadow = '0 2px 0 #070510';
      this.tabGraphicsBtn.style.color = '#c4b5fd';

      if (this.soundContent) this.soundContent.style.display = 'flex';
      if (this.graphicsContent) this.graphicsContent.style.display = 'none';
    } else {
      this.tabGraphicsBtn.style.background = 'linear-gradient(180deg, #eab308 0%, #ca8a04 100%)';
      this.tabGraphicsBtn.style.border = '2px solid #ffffff';
      this.tabGraphicsBtn.style.boxShadow = '0 3px 0 #0f0b17';
      this.tabGraphicsBtn.style.color = '#ffffff';

      this.tabSoundBtn.style.background = 'linear-gradient(180deg, #382952 0%, #201533 100%)';
      this.tabSoundBtn.style.border = '2px solid #5a4575';
      this.tabSoundBtn.style.boxShadow = '0 2px 0 #070510';
      this.tabSoundBtn.style.color = '#c4b5fd';

      if (this.soundContent) this.soundContent.style.display = 'none';
      if (this.graphicsContent) this.graphicsContent.style.display = 'flex';
    }
  }

  // =========================================================================
  // Sound Controls
  // =========================================================================
  public setMasterVolume(val: number): void {
    const clamped = Math.min(1, Math.max(0, Math.round(val * 100) / 100));
    this.soundSettings.masterVolume = clamped;
    this.audio?.setMasterVolume(clamped);
    this.updateSoundDisplay();
    this.options.onVolumeChange?.('master', clamped);
    this.options.onSoundChange?.(this.getSoundSettings());
  }

  public setBgmVolume(val: number): void {
    const clamped = Math.min(1, Math.max(0, Math.round(val * 100) / 100));
    this.soundSettings.bgmVolume = clamped;
    this.audio?.setBgmVolume(clamped);
    this.updateSoundDisplay();
    this.options.onVolumeChange?.('bgm', clamped);
    this.options.onSoundChange?.(this.getSoundSettings());
  }

  public setSfxVolume(val: number): void {
    const clamped = Math.min(1, Math.max(0, Math.round(val * 100) / 100));
    this.soundSettings.sfxVolume = clamped;
    this.audio?.setSfxVolume(clamped);
    this.updateSoundDisplay();
    this.options.onVolumeChange?.('sfx', clamped);
    this.options.onSoundChange?.(this.getSoundSettings());
  }

  public setMuted(muted: boolean): void {
    this.soundSettings.muted = muted;
    this.audio?.setMuted(muted);
    this.updateSoundDisplay();
    this.options.onMuteToggle?.(muted);
    this.options.onSoundChange?.(this.getSoundSettings());
  }

  public toggleMute(): boolean {
    const next = !this.soundSettings.muted;
    this.playSfx('click');
    this.setMuted(next);
    return next;
  }

  public getSoundSettings(): AudioEngineSettings {
    return { ...this.soundSettings };
  }

  private updateSoundDisplay(): void {
    if (this.masterValText) {
      this.masterValText.textContent = `${Math.round(this.soundSettings.masterVolume * 100)}%`;
    }
    if (this.masterSlider) {
      this.masterSlider.value = String(Math.round(this.soundSettings.masterVolume * 100));
    }
    if (this.bgmValText) {
      this.bgmValText.textContent = `${Math.round(this.soundSettings.bgmVolume * 100)}%`;
    }
    if (this.bgmSlider) {
      this.bgmSlider.value = String(Math.round(this.soundSettings.bgmVolume * 100));
    }
    if (this.sfxValText) {
      this.sfxValText.textContent = `${Math.round(this.soundSettings.sfxVolume * 100)}%`;
    }
    if (this.sfxSlider) {
      this.sfxSlider.value = String(Math.round(this.soundSettings.sfxVolume * 100));
    }

    if (this.muteBtn) {
      this.muteBtn.textContent = this.soundSettings.muted ? '🔇 SOUND: MUTED' : '🔊 SOUND: ON';
      this.muteBtn.style.background = this.soundSettings.muted
        ? 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)'
        : 'linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%)';
    }
  }

  // =========================================================================
  // Graphics Controls
  // =========================================================================
  public toggleFullscreen(): void {
    this.playSfx('click');
    if (typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        (this.container || document.documentElement).requestFullscreen?.().catch(() => {});
        this.graphicsSettings.fullscreen = true;
      } else {
        document.exitFullscreen?.().catch(() => {});
        this.graphicsSettings.fullscreen = false;
      }
    } else {
      this.graphicsSettings.fullscreen = !this.graphicsSettings.fullscreen;
    }

    this.updateGraphicsDisplay();
    this.options.onToggleFullscreen?.();
    this.options.onGraphicsChange?.(this.getGraphicsSettings());
  }

  public setGraphicsOption(key: keyof GraphicsSettings, value: boolean): void {
    this.graphicsSettings[key] = value;
    this.updateGraphicsDisplay();
    this.options.onGraphicsChange?.(this.getGraphicsSettings());

    if (key === 'windSway') {
      this.options.onToggleWindSway?.(value);
    } else if (key === 'ambientFireflies') {
      this.options.onToggleFireflies?.(value);
    } else if (key === 'vignette') {
      this.options.onToggleVignette?.(value);
    }
  }

  public toggleGraphicsOption(key: keyof GraphicsSettings): boolean {
    this.playSfx('click');
    const next = !this.graphicsSettings[key];
    this.setGraphicsOption(key, next);
    return next;
  }

  public getGraphicsSettings(): GraphicsSettings {
    return { ...this.graphicsSettings };
  }

  private updateGraphicsDisplay(): void {
    if (this.fullscreenBtn) {
      this.fullscreenBtn.textContent = this.graphicsSettings.fullscreen
        ? '🖥️ FULLSCREEN: ON'
        : '🖥️ FULLSCREEN: OFF';
      this.fullscreenBtn.style.background = this.graphicsSettings.fullscreen
        ? 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)'
        : 'linear-gradient(180deg, #64748b 0%, #475569 100%)';
    }

    if (this.windSwayBtn) {
      this.windSwayBtn.textContent = this.graphicsSettings.windSway
        ? '🍃 WIND SWAY: ON'
        : '🍃 WIND SWAY: OFF';
      this.windSwayBtn.style.background = this.graphicsSettings.windSway
        ? 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)'
        : 'linear-gradient(180deg, #475569 0%, #334155 100%)';
    }

    if (this.firefliesBtn) {
      this.firefliesBtn.textContent = this.graphicsSettings.ambientFireflies
        ? '✨ FIREFLIES: ON'
        : '✨ FIREFLIES: OFF';
      this.firefliesBtn.style.background = this.graphicsSettings.ambientFireflies
        ? 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)'
        : 'linear-gradient(180deg, #475569 0%, #334155 100%)';
    }

    if (this.vignetteBtn) {
      this.vignetteBtn.textContent = this.graphicsSettings.vignette
        ? '🎬 VIGNETTE: ON'
        : '🎬 VIGNETTE: OFF';
      this.vignetteBtn.style.background = this.graphicsSettings.vignette
        ? 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)'
        : 'linear-gradient(180deg, #475569 0%, #334155 100%)';
    }
  }

  // =========================================================================
  // Navigation & Lifecycle
  // =========================================================================
  public returnToMainMenu(): void {
    this.playSfx('click');
    this.hide();
    const onReturn =
      this.options.onReturnToMainMenu ??
      this.options.onReturnToMenu ??
      this.options.onMainMenu;
    onReturn?.();
  }

  public close(): void {
    this.playSfx('click');
    this.hide();
    this.options.onClose?.();
  }

  private playSfx(type: 'click'): void {
    try {
      this.audio?.playSfx(type);
    } catch {
      // Audio play failure ignored safely
    }
  }

  public destroy(): void {
    this.hide();
    if (this.modalElement && this.modalElement.parentElement) {
      this.modalElement.parentElement.removeChild(this.modalElement);
    }
    this.modalElement = null;
    this.container = null;
  }
}
