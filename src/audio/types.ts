// src/audio/types.ts

export type SfxType =
  | 'click'
  | 'coin'
  | 'upgrade'
  | 'catch'
  | 'fanfare'
  | 'frenzy'
  | 'petting';

export interface AudioEngineSettings {
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export interface AudioEngineOptions {
  masterVolume?: number;
  bgmVolume?: number;
  sfxVolume?: number;
  muted?: boolean;
  onSettingsChange?: (settings: AudioEngineSettings) => void;
}

export interface IAudioEngine {
  init(): Promise<void>;
  playSfx(type: SfxType): void;
  setMasterVolume(val: number): void;
  setBgmVolume(val: number): void;
  setSfxVolume(val: number): void;
  toggleMute(): boolean;
  setMuted(val: boolean): void;
  startBgm(): void;
  stopBgm(): void;
  getSettings(): Readonly<AudioEngineSettings>;
  isAvailable(): boolean;
  destroy(): void;
}
