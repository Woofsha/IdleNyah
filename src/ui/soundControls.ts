// src/ui/soundControls.ts
import { Container, Text, TextStyle } from 'pixi.js';
import type { IAudioEngine } from '../audio/types';
import { PixelButton } from './components/pixelButton';

export interface SoundControlsOptions {
  audio: IAudioEngine;
  onVolumeChange?: () => void;
}

export class SoundControls extends Container {
  private audio: IAudioEngine;
  private muteBtn: PixelButton;
  private masterText: Text;
  private bgmText: Text;
  private sfxText: Text;

  constructor(options: SoundControlsOptions) {
    super();
    this.audio = options.audio;

    const labelStyle = new TextStyle({
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: 10,
      fill: '#cfc9e2',
      fontWeight: 'bold',
    });

    const settings = this.audio.getSettings();

    // 1. Mute Button
    this.muteBtn = new PixelButton({
      width: 76,
      height: 24,
      text: settings.muted ? '🔇 MUTED' : '🔊 SOUND',
      variant: settings.muted ? 'gold' : 'purple',
      fontSize: 10,
      onClick: () => {
        const isMuted = this.audio.toggleMute();
        this.muteBtn.setText(isMuted ? '🔇 MUTED' : '🔊 SOUND');
        this.muteBtn.setSelected(isMuted);
        this.audio.playSfx('click');
        options.onVolumeChange?.();
      },
    });
    this.muteBtn.position.set(0, 0);
    this.addChild(this.muteBtn);

    // 2. Master Vol: [ - ] Master: 100% [ + ]
    let curX = 84;
    const masterMinus = new PixelButton({
      width: 18,
      height: 24,
      text: '-',
      fontSize: 12,
      onClick: () => {
        const cur = this.audio.getSettings().masterVolume;
        this.audio.setMasterVolume(Math.max(0, Math.round((cur - 0.1) * 10) / 10));
        this.updateLabels();
        this.audio.playSfx('click');
        options.onVolumeChange?.();
      },
    });
    masterMinus.position.set(curX, 0);
    this.addChild(masterMinus);

    curX += 22;
    this.masterText = new Text({
      text: `Mst:${Math.round(settings.masterVolume * 100)}%`,
      style: labelStyle,
      x: curX,
      y: 6,
    });
    this.addChild(this.masterText);

    curX += 54;
    const masterPlus = new PixelButton({
      width: 18,
      height: 24,
      text: '+',
      fontSize: 12,
      onClick: () => {
        const cur = this.audio.getSettings().masterVolume;
        this.audio.setMasterVolume(Math.min(1, Math.round((cur + 0.1) * 10) / 10));
        this.updateLabels();
        this.audio.playSfx('click');
        options.onVolumeChange?.();
      },
    });
    masterPlus.position.set(curX, 0);
    this.addChild(masterPlus);

    // 3. BGM Vol: [ - ] BGM: 80% [ + ]
    curX += 26;
    const bgmMinus = new PixelButton({
      width: 18,
      height: 24,
      text: '-',
      fontSize: 12,
      onClick: () => {
        const cur = this.audio.getSettings().bgmVolume;
        this.audio.setBgmVolume(Math.max(0, Math.round((cur - 0.1) * 10) / 10));
        this.updateLabels();
        this.audio.playSfx('click');
        options.onVolumeChange?.();
      },
    });
    bgmMinus.position.set(curX, 0);
    this.addChild(bgmMinus);

    curX += 22;
    this.bgmText = new Text({
      text: `BGM:${Math.round(settings.bgmVolume * 100)}%`,
      style: labelStyle,
      x: curX,
      y: 6,
    });
    this.addChild(this.bgmText);

    curX += 54;
    const bgmPlus = new PixelButton({
      width: 18,
      height: 24,
      text: '+',
      fontSize: 12,
      onClick: () => {
        const cur = this.audio.getSettings().bgmVolume;
        this.audio.setBgmVolume(Math.min(1, Math.round((cur + 0.1) * 10) / 10));
        this.updateLabels();
        this.audio.playSfx('click');
        options.onVolumeChange?.();
      },
    });
    bgmPlus.position.set(curX, 0);
    this.addChild(bgmPlus);

    // 4. SFX Vol: [ - ] SFX: 100% [ + ]
    curX += 26;
    const sfxMinus = new PixelButton({
      width: 18,
      height: 24,
      text: '-',
      fontSize: 12,
      onClick: () => {
        const cur = this.audio.getSettings().sfxVolume;
        this.audio.setSfxVolume(Math.max(0, Math.round((cur - 0.1) * 10) / 10));
        this.updateLabels();
        this.audio.playSfx('click');
        options.onVolumeChange?.();
      },
    });
    sfxMinus.position.set(curX, 0);
    this.addChild(sfxMinus);

    curX += 22;
    this.sfxText = new Text({
      text: `SFX:${Math.round(settings.sfxVolume * 100)}%`,
      style: labelStyle,
      x: curX,
      y: 6,
    });
    this.addChild(this.sfxText);

    curX += 54;
    const sfxPlus = new PixelButton({
      width: 18,
      height: 24,
      text: '+',
      fontSize: 12,
      onClick: () => {
        const cur = this.audio.getSettings().sfxVolume;
        this.audio.setSfxVolume(Math.min(1, Math.round((cur + 0.1) * 10) / 10));
        this.updateLabels();
        this.audio.playSfx('click');
        options.onVolumeChange?.();
      },
    });
    sfxPlus.position.set(curX, 0);
    this.addChild(sfxPlus);
  }

  public updateLabels(): void {
    const s = this.audio.getSettings();
    this.muteBtn.setText(s.muted ? '🔇 MUTED' : '🔊 SOUND');
    this.muteBtn.setSelected(s.muted);
    this.masterText.text = `Mst:${Math.round(s.masterVolume * 100)}%`;
    this.bgmText.text = `BGM:${Math.round(s.bgmVolume * 100)}%`;
    this.sfxText.text = `SFX:${Math.round(s.sfxVolume * 100)}%`;
  }
}
