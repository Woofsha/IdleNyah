// src/audio/engine.ts
import type { AudioEngineOptions, AudioEngineSettings, IAudioEngine, SfxType } from './types';
import { playProceduralSfx } from './sfx';
import { ProceduralBgmPlayer } from './bgm';

/**
 * Top-level AudioEngine managing native Web Audio API audio graph and procedural synthesis.
 * Fully decoupled and zero-dependency. Safely operates in headless Node.js test environments
 * without crashing or throwing ReferenceError.
 */
export class AudioEngine implements IAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  private bgmPlayer = new ProceduralBgmPlayer();

  private settings: AudioEngineSettings = {
    masterVolume: 1.0,
    bgmVolume: 0.8,
    sfxVolume: 1.0,
    muted: false,
  };

  private onSettingsChange?: (settings: AudioEngineSettings) => void;
  private unlockHandler: (() => void) | null = null;
  private initialized = false;

  constructor(options?: AudioEngineOptions) {
    if (options) {
      if (options.masterVolume !== undefined) {
        this.settings.masterVolume = this.clamp(options.masterVolume);
      }
      if (options.bgmVolume !== undefined) {
        this.settings.bgmVolume = this.clamp(options.bgmVolume);
      }
      if (options.sfxVolume !== undefined) {
        this.settings.sfxVolume = this.clamp(options.sfxVolume);
      }
      if (options.muted !== undefined) {
        this.settings.muted = Boolean(options.muted);
      }
      this.onSettingsChange = options.onSettingsChange;
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Detect browser AudioContext safely without throwing in Node.js
    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : typeof globalThis !== 'undefined' && 'AudioContext' in globalThis
          ? (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext
          : null;

    if (!AudioContextClass) {
      // Headless / Node.js environment: safe no-op
      return;
    }

    try {
      this.ctx = new AudioContextClass();

      // Audio Graph:
      // SFX -> sfxGain --\
      //                   +-> masterGain -> ctx.destination
      // BGM -> bgmGain --/
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();

      this.applyGains();

      this.sfxGain.connect(this.masterGain);
      this.bgmGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Handle browser autoplay policy: unlock on first user gesture
      if (typeof window !== 'undefined') {
        const unlock = () => {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
          }
          this.removeUnlockListeners();
        };

        this.unlockHandler = unlock;
        window.addEventListener('pointerdown', unlock, { passive: true, capture: true });
        window.addEventListener('keydown', unlock, { passive: true, capture: true });
        window.addEventListener('click', unlock, { passive: true, capture: true });
      }
    } catch {
      // AudioContext creation failure fallback
      this.ctx = null;
    }
  }

  public playSfx(type: SfxType): void {
    if (!this.ctx || !this.sfxGain) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    try {
      playProceduralSfx(this.ctx, this.sfxGain, type);
    } catch {
      // Safe ignore playback failure
    }
  }

  public startBgm(): void {
    if (!this.ctx || !this.bgmGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.bgmPlayer.start(this.ctx, this.bgmGain);
  }

  public stopBgm(): void {
    this.bgmPlayer.stop();
  }

  public setMasterVolume(val: number): void {
    this.settings.masterVolume = this.clamp(val);
    this.applyGains();
    this.notifySettings();
  }

  public setBgmVolume(val: number): void {
    this.settings.bgmVolume = this.clamp(val);
    this.applyGains();
    this.notifySettings();
  }

  public setSfxVolume(val: number): void {
    this.settings.sfxVolume = this.clamp(val);
    this.applyGains();
    this.notifySettings();
  }

  public toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.applyGains();
    this.notifySettings();
    return this.settings.muted;
  }

  public setMuted(val: boolean): void {
    this.settings.muted = Boolean(val);
    this.applyGains();
    this.notifySettings();
  }

  public getSettings(): Readonly<AudioEngineSettings> {
    return { ...this.settings };
  }

  public isAvailable(): boolean {
    return this.ctx !== null;
  }

  public destroy(): void {
    this.stopBgm();
    this.removeUnlockListeners();

    if (this.ctx) {
      try {
        this.ctx.close().catch(() => {});
      } catch {
        // Safe ignore
      }
      this.ctx = null;
    }
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
  }

  private applyGains(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (this.masterGain) {
      const targetMaster = this.settings.muted ? 0 : this.settings.masterVolume;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setValueAtTime(targetMaster, t);
    }

    if (this.sfxGain) {
      this.sfxGain.gain.cancelScheduledValues(t);
      this.sfxGain.gain.setValueAtTime(this.settings.sfxVolume, t);
    }

    if (this.bgmGain) {
      this.bgmGain.gain.cancelScheduledValues(t);
      this.bgmGain.gain.setValueAtTime(this.settings.bgmVolume, t);
    }
  }

  private clamp(val: number): number {
    if (Number.isNaN(val)) return 0;
    return Math.max(0, Math.min(1, val));
  }

  private notifySettings(): void {
    if (this.onSettingsChange) {
      this.onSettingsChange({ ...this.settings });
    }
  }

  private removeUnlockListeners(): void {
    if (this.unlockHandler && typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.unlockHandler, { capture: true });
      window.removeEventListener('keydown', this.unlockHandler, { capture: true });
      window.removeEventListener('click', this.unlockHandler, { capture: true });
      this.unlockHandler = null;
    }
  }
}

// Singleton helper instance
let defaultEngineInstance: AudioEngine | null = null;

export function getAudioEngine(options?: AudioEngineOptions): AudioEngine {
  if (!defaultEngineInstance) {
    defaultEngineInstance = new AudioEngine(options);
  }
  return defaultEngineInstance;
}
