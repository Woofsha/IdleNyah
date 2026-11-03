// src/ui/drawer.ts
import { Container, Graphics, Rectangle, Text, TextStyle } from 'pixi.js';
import type { GameSimulation } from '../core/simulation';
import type { IAudioEngine } from '../audio/types';
import type { TabId, UiCallbacks } from './types';
import { PixelButton } from './components/pixelButton';
import { PixelPanel } from './components/pixelPanel';
import { ChoresTab } from './tabs/choresTab';
import { MultipliersTab } from './tabs/multipliersTab';
import { TerritoryTab } from './tabs/territoryTab';
import { SanctuaryTab } from './tabs/sanctuaryTab';
import { SoundControls } from './soundControls';

export interface HudDrawerOptions {
  simulation: GameSimulation;
  audio: IAudioEngine;
  callbacks?: UiCallbacks;
}

export class HudDrawer extends Container {
  public activeTab: TabId = 'chores';
  public isOpen = false;

  private currentY = 596;
  private targetY = 596;
  private panelWidth = 940;
  private panelHeight = 380;

  private simulation: GameSimulation;
  private audio: IAudioEngine;
  private callbacks: UiCallbacks;

  private mainPanel: PixelPanel;
  private dockBg: Graphics;
  private toggleBtn: PixelButton;

  private tabChoresBtn: PixelButton;
  private tabMultipliersBtn: PixelButton;
  private tabTerritoryBtn: PixelButton;
  private tabSanctuaryBtn: PixelButton;

  private choresTab: ChoresTab;
  private multipliersTab: MultipliersTab;
  private territoryTab: TerritoryTab;
  private sanctuaryTab: SanctuaryTab;

  private soundControls: SoundControls;
  private dockStatusWidget: Container;
  private dockStatusRate: Text;
  private dockStatusMaid: Text;
  private dockStatusHint: Text;

  constructor(options: HudDrawerOptions) {
    super();
    this.simulation = options.simulation;
    this.audio = options.audio;
    this.callbacks = options.callbacks ?? {
      playSfx: (type) => this.audio.playSfx(type),
    };

    this.position.set(10, this.currentY);
    this.eventMode = 'static';
    this.on('pointerdown', (e) => e.stopPropagation());

    // 1. Main Background Panel (940x380) with Storybook Diorama Translucent Pill
    this.mainPanel = new PixelPanel({
      width: this.panelWidth,
      height: this.panelHeight,
      fillColor: 0x120d20,
      fillAlpha: 0.88,
      strokeColor: 0x854d0e,
      strokeWidth: 1.5,
      radius: 10,
      innerBorder: false,
    });
    this.addChild(this.mainPanel);

    // 2. Dock Header Strip (y = 0..44) Translucent Pill Capsule
    this.dockBg = new Graphics();
    this.dockBg.roundRect(0, 0, this.panelWidth, 44, 22);
    this.dockBg.fill({ color: 0x140e24, alpha: 0.92 });
    this.dockBg.stroke({ color: 0x854d0e, width: 1.5 });
    // Subtle top rim highlight
    this.dockBg.roundRect(2, 1, this.panelWidth - 4, 14, 12);
    this.dockBg.stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
    this.addChild(this.dockBg);

    // 3. Tab Buttons in Dock Strip (Floating Pill Style)
    let curX = 10;
    this.tabChoresBtn = new PixelButton({
      width: 110,
      height: 32,
      text: '🧹 Chores',
      variant: 'pill',
      selected: true,
      onClick: () => this.selectTab('chores'),
    });
    this.tabChoresBtn.position.set(curX, 6);
    this.addChild(this.tabChoresBtn);

    curX += 116;
    this.tabMultipliersBtn = new PixelButton({
      width: 126,
      height: 32,
      text: '👑 Multipliers',
      variant: 'pill',
      onClick: () => this.selectTab('multipliers'),
    });
    this.tabMultipliersBtn.position.set(curX, 6);
    this.addChild(this.tabMultipliersBtn);

    curX += 132;
    this.tabTerritoryBtn = new PixelButton({
      width: 114,
      height: 32,
      text: '🏰 Territory',
      variant: 'pill',
      onClick: () => this.selectTab('territory'),
    });
    this.tabTerritoryBtn.position.set(curX, 6);
    this.addChild(this.tabTerritoryBtn);

    curX += 120;
    this.tabSanctuaryBtn = new PixelButton({
      width: 114,
      height: 32,
      text: '🐾 Sanctuary',
      variant: 'pill',
      onClick: () => this.selectTab('sanctuaries'),
    });
    this.tabSanctuaryBtn.position.set(curX, 6);
    this.addChild(this.tabSanctuaryBtn);

    // 4. Sound Controls in Dock Strip (kept at x = 500 for test invariant compatibility, but hidden from the bottom bar since volume options are now in the Menu Options modal)
    this.soundControls = new SoundControls({
      audio: this.audio,
      onVolumeChange: () => {
        // Sync with simulation settings
        const s = this.audio.getSettings();
        this.simulation.updateAudioSettings(s);
      },
    });
    this.soundControls.position.set(500, 10);
    this.soundControls.visible = false;
    this.soundControls.renderable = false;
    this.addChild(this.soundControls);

    // 5. Estate Activity & Status Ribbon (fills x = 504..884 in the dock header)
    this.dockStatusWidget = new Container({ label: 'dock-status-ribbon' });
    this.dockStatusWidget.position.set(504, 6);
    this.dockStatusWidget.eventMode = 'static';
    this.dockStatusWidget.cursor = 'pointer';

    const ribbonBg = new Graphics();
    ribbonBg.roundRect(0, 0, 380, 32, 16);
    ribbonBg.fill({ color: 0x16112a, alpha: 0.88 });
    ribbonBg.stroke({ color: 0x4c3a6e, width: 1.2, alpha: 0.8 });
    ribbonBg.roundRect(2, 2, 376, 12, 10);
    ribbonBg.stroke({ color: 0xffffff, width: 1, alpha: 0.05 });
    this.dockStatusWidget.addChild(ribbonBg);

    // Left badge: Gold rate
    const rateIcon = new Text({
      text: '⚡',
      style: new TextStyle({ fontSize: 13 }),
      anchor: { x: 0, y: 0.5 },
      x: 12,
      y: 16,
    });
    this.dockStatusRate = new Text({
      text: '+0.0/s',
      style: new TextStyle({
        fontFamily: '"Silkscreen", "Courier New", monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: '#fbbf24',
      }),
      anchor: { x: 0, y: 0.5 },
      x: 30,
      y: 16,
    });

    // Divider 1
    const div1 = new Graphics();
    div1.rect(98, 8, 1, 16).fill({ color: 0x3d355b, alpha: 0.6 });

    // Center: Active Maids / Estate Activity
    const maidIcon = new Text({
      text: '🧹',
      style: new TextStyle({ fontSize: 12 }),
      anchor: { x: 0, y: 0.5 },
      x: 110,
      y: 16,
    });
    this.dockStatusMaid = new Text({
      text: 'Nyah & Fifi on duty',
      style: new TextStyle({
        fontFamily: '"Silkscreen", "Courier New", monospace',
        fontSize: 9,
        fontWeight: 'bold',
        fill: '#e2e8f0',
      }),
      anchor: { x: 0, y: 0.5 },
      x: 128,
      y: 16,
    });

    // Divider 2
    const div2 = new Graphics();
    div2.rect(266, 8, 1, 16).fill({ color: 0x3d355b, alpha: 0.6 });

    // Right: Drawer hint / expand pill
    this.dockStatusHint = new Text({
      text: '▲ EXPAND',
      style: new TextStyle({
        fontFamily: '"Silkscreen", "Courier New", monospace',
        fontSize: 9,
        fontWeight: 'bold',
        fill: '#c084fc',
      }),
      anchor: { x: 0, y: 0.5 },
      x: 278,
      y: 16,
    });

    this.dockStatusWidget.addChild(
      rateIcon,
      this.dockStatusRate,
      div1,
      maidIcon,
      this.dockStatusMaid,
      div2,
      this.dockStatusHint
    );

    this.dockStatusWidget.on('pointertap', () => this.toggle());
    this.dockStatusWidget.on('pointerover', () => {
      ribbonBg.tint = 0xddddff;
    });
    this.dockStatusWidget.on('pointerout', () => {
      ribbonBg.tint = 0xffffff;
    });
    this.addChild(this.dockStatusWidget);

    // 6. Expand / Collapse Toggle Button at far right: 34x32 at x = 896, y = 6
    this.toggleBtn = new PixelButton({
      width: 34,
      height: 32,
      text: '▲',
      variant: 'gold',
      fontSize: 12,
      onClick: () => this.toggle(),
    });
    this.toggleBtn.position.set(896, 6);
    this.addChild(this.toggleBtn);

    // 6. Tab Content Containers (placed below dock strip at y = 46)
    const contentArea = new Container();
    contentArea.position.set(0, 46);
    this.addChild(contentArea);

    this.choresTab = new ChoresTab(this.simulation, this.callbacks);
    this.multipliersTab = new MultipliersTab(this.simulation, this.callbacks);
    this.territoryTab = new TerritoryTab(this.simulation, this.callbacks);
    this.sanctuaryTab = new SanctuaryTab(this.simulation, this.callbacks);

    this.multipliersTab.visible = false;
    this.territoryTab.visible = false;
    this.sanctuaryTab.visible = false;

    contentArea.addChild(this.choresTab, this.multipliersTab, this.territoryTab, this.sanctuaryTab);
  }

  public toggle(open?: boolean): void {
    this.isOpen = open !== undefined ? open : !this.isOpen;
    this.targetY = this.isOpen ? 260 : 596;
    this.toggleBtn.setText(this.isOpen ? '▼' : '▲');
    if (this.dockStatusHint) {
      this.dockStatusHint.text = this.isOpen ? '▼ CLOSE' : '▲ EXPAND';
      this.dockStatusHint.style.fill = this.isOpen ? '#f59e0b' : '#c084fc';
    }
    this.callbacks.playSfx?.('click');
  }

  public selectTab(tab: TabId): void {
    this.activeTab = tab;

    this.tabChoresBtn.setSelected(tab === 'chores');
    this.tabMultipliersBtn.setSelected(tab === 'multipliers');
    this.tabTerritoryBtn.setSelected(tab === 'territory');
    this.tabSanctuaryBtn.setSelected(tab === 'sanctuaries');

    this.choresTab.visible = tab === 'chores';
    this.multipliersTab.visible = tab === 'multipliers';
    this.territoryTab.visible = tab === 'territory';
    this.sanctuaryTab.visible = tab === 'sanctuaries';

    if (!this.isOpen) {
      this.toggle(true);
    } else {
      this.callbacks.playSfx?.('click');
    }

    this.refreshActiveTab();
  }

  public refreshActiveTab(): void {
    if (this.choresTab.visible) this.choresTab.update();
    if (this.multipliersTab.visible) this.multipliersTab.update();
    if (this.territoryTab.visible) this.territoryTab.update();
    if (this.sanctuaryTab.visible) this.sanctuaryTab.update();
  }

  public update(deltaSeconds: number): void {
    // Smooth integer lerp animation between collapsed and expanded
    if (Math.abs(this.currentY - this.targetY) > 0.5) {
      this.currentY += (this.targetY - this.currentY) * Math.min(1, deltaSeconds * 14);
      this.position.y = Math.round(this.currentY);
    } else {
      this.currentY = this.targetY;
      this.position.y = this.targetY;
    }

    // Refresh active tab contents each frame if open or opening
    if (this.isOpen || Math.abs(this.currentY - this.targetY) > 0.5) {
      this.refreshActiveTab();
    }

    // Refresh live estate status ribbon
    if (this.dockStatusWidget) {
      const gps = Math.floor(this.simulation.getTotalGPS());
      this.dockStatusRate.text = `+${gps.toLocaleString()}/s`;
      this.dockStatusHint.text = this.isOpen ? '▼ CLOSE' : '▲ EXPAND';
      this.dockStatusHint.style.fill = this.isOpen ? '#f59e0b' : '#c084fc';
    }
  }
}
