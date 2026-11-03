// src/ui/tabs/choresTab.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameSimulation } from '../../core/simulation';
import { FIFI_FACILITIES } from '../../core/facilities';
import { calculateMaxAffordable } from '../../core/math';
import type { BulkBuyMode, UiCallbacks } from '../types';
import { PixelButton } from '../components/pixelButton';
import { PixelPanel } from '../components/pixelPanel';

interface FacilityCardViews {
  cardPanel: PixelPanel;
  nameText: Text;
  levelBadge: Text;
  prodText: Text;
  buyBtn: PixelButton;
  id: string;
}

const FACILITY_ICONS: Record<string, string> = {
  fifi_broom: '🧹',
  fifi_duster: '🪶',
  fifi_garden: '🌾',
  fifi_kettle: '🫖',
  fifi_kitchen: '🍳',
  fifi_laundry: '🧺',
  fifi_carriage: '🐎',
  fifi_vault: '🏛️',
};

export class ChoresTab extends Container {
  private simulation: GameSimulation;
  private callbacks: UiCallbacks;
  private bulkMode: BulkBuyMode = 1;

  private bulk1xBtn: PixelButton;
  private bulk10xBtn: PixelButton;
  private bulk25xBtn: PixelButton;
  private bulkMaxBtn: PixelButton;

  private cardViews: FacilityCardViews[] = [];

  constructor(simulation: GameSimulation, callbacks: UiCallbacks = {}) {
    super();
    this.simulation = simulation;
    this.callbacks = callbacks;

    // 1. Bulk Buy Bar at top: y = 6, height = 28
    const bulkBarLabel = new Text({
      text: 'Bulk Buy:',
      style: new TextStyle({
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 11,
        fontWeight: 'bold',
        fill: '#b3a9d4',
      }),
      x: 14,
      y: 8,
    });
    this.addChild(bulkBarLabel);

    this.bulk1xBtn = new PixelButton({
      width: 58,
      height: 24,
      text: '1x',
      variant: 'pill',
      selected: true,
      onClick: () => this.setBulkMode(1),
    });
    this.bulk1xBtn.position.set(88, 5);

    this.bulk10xBtn = new PixelButton({
      width: 58,
      height: 24,
      text: '10x',
      variant: 'pill',
      onClick: () => this.setBulkMode(10),
    });
    this.bulk10xBtn.position.set(154, 5);

    this.bulk25xBtn = new PixelButton({
      width: 58,
      height: 24,
      text: '25x',
      variant: 'pill',
      onClick: () => this.setBulkMode(25),
    });
    this.bulk25xBtn.position.set(220, 5);

    this.bulkMaxBtn = new PixelButton({
      width: 64,
      height: 24,
      text: 'MAX',
      variant: 'pill',
      onClick: () => this.setBulkMode(-1),
    });
    this.bulkMaxBtn.position.set(286, 5);

    this.addChild(this.bulk1xBtn, this.bulk10xBtn, this.bulk25xBtn, this.bulkMaxBtn);

    // 2. 8 Facility Cards in 2 columns x 4 rows
    // Grid: col 0 at x = 12, col 1 at x = 466. Row 0 at y = 36, row spacing 68px.
    const cardWidth = 444;
    const cardHeight = 62;

    FIFI_FACILITIES.forEach((fac, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const cardX = col === 0 ? 12 : 464;
      const cardY = 36 + row * 66;

      const cardContainer = new Container();
      cardContainer.position.set(cardX, cardY);

      const cardPanel = new PixelPanel({
        width: cardWidth,
        height: cardHeight,
        fillColor: 0x1d1930,
        strokeColor: 0x3d355b,
        radius: 4,
      });
      cardContainer.addChild(cardPanel);

      // Icon box on left: 38x38 at x = 8, y = 12
      const iconBox = new Graphics();
      iconBox.roundRect(8, 12, 38, 38, 4);
      iconBox.fill({ color: 0x120f20, alpha: 0.9 });
      iconBox.stroke({ color: 0x483e6a, width: 1 });
      cardContainer.addChild(iconBox);

      const iconGlyph = FACILITY_ICONS[fac.id] ?? '✨';
      const iconText = new Text({
        text: iconGlyph,
        style: new TextStyle({
          fontSize: 18,
          align: 'center',
        }),
      });
      iconText.anchor.set(0.5, 0.5);
      iconText.position.set(27, 31);
      cardContainer.addChild(iconText);

      // Name & Level Badge
      const nameText = new Text({
        text: fac.name,
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 12,
          fontWeight: 'bold',
          fill: '#ffffff',
        }),
        x: 54,
        y: 11,
      });
      cardContainer.addChild(nameText);

      const levelBadge = new Text({
        text: 'Lv. 0',
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#ffd54f',
        }),
        x: 54 + nameText.width + 8,
        y: 12,
      });
      cardContainer.addChild(levelBadge);

      // GPS Production info
      const prodText = new Text({
        text: '+0 gold/s',
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 10,
          fill: '#81c784',
        }),
        x: 54,
        y: 35,
      });
      cardContainer.addChild(prodText);

      // Buy Button on right side: 108x44 at x = 328, y = 9
      const buyBtn = new PixelButton({
        width: 108,
        height: 44,
        text: 'Buy +1',
        subText: `${fac.baseCost}g`,
        variant: 'gold',
        fontSize: 11,
        subFontSize: 10,
        onClick: () => {
          const success = this.simulation.buyFacility(fac.id, this.bulkMode);
          if (success) {
            this.callbacks.playSfx?.('upgrade');
            this.update();
          }
        },
      });
      buyBtn.position.set(328, 9);
      cardContainer.addChild(buyBtn);

      this.addChild(cardContainer);

      this.cardViews.push({
        cardPanel,
        nameText,
        levelBadge,
        prodText,
        buyBtn,
        id: fac.id,
      });
    });

    this.update();
  }

  public setBulkMode(mode: BulkBuyMode): void {
    this.bulkMode = mode;
    this.bulk1xBtn.setSelected(mode === 1);
    this.bulk10xBtn.setSelected(mode === 10);
    this.bulk25xBtn.setSelected(mode === 25);
    this.bulkMaxBtn.setSelected(mode === -1);
    this.callbacks.playSfx?.('click');
    this.update();
  }

  public getBulkMode(): BulkBuyMode {
    return this.bulkMode;
  }

  public update(): void {
    const state = this.simulation.getState();
    const gold = state.currencies.gold;

    for (const card of this.cardViews) {
      const fac = FIFI_FACILITIES.find((f) => f.id === card.id);
      if (!fac) continue;

      const currentLevel = state.facilities[fac.id]?.level ?? 0;
      card.levelBadge.text = `Lv.${currentLevel}`;
      card.levelBadge.x = card.nameText.x + card.nameText.width + 6;

      // Isolated production
      const currentProd = this.simulation.getFacilityProduction(fac.id);
      let prodStr = `+${Math.floor(currentProd).toLocaleString()} gold/s`;
      if (fac.secondaryOutput && currentLevel > 0) {
        const secRate = fac.secondaryOutput.rate * currentLevel;
        prodStr += ` (+${secRate.toFixed(1)} ${fac.secondaryOutput.currency}/s)`;
      }
      card.prodText.text = prodStr;

      // Buy cost & affordable count
      if (this.bulkMode === -1) {
        const maxAfford = calculateMaxAffordable(gold, fac.baseCost, fac.costRatio, currentLevel);
        if (maxAfford.count > 0) {
          card.buyBtn.setText(`Buy +${maxAfford.count}`, `${Math.floor(maxAfford.cost).toLocaleString()}g`);
          card.buyBtn.setDisabled(false);
        } else {
          const nextSingleCost = this.simulation.getUpgradeCost(fac.id, 1);
          card.buyBtn.setText('Buy +1', `${Math.floor(nextSingleCost).toLocaleString()}g`);
          card.buyBtn.setDisabled(true);
        }
      } else {
        const cost = this.simulation.getUpgradeCost(fac.id, this.bulkMode);
        card.buyBtn.setText(`Buy +${this.bulkMode}`, `${Math.floor(cost).toLocaleString()}g`);
        card.buyBtn.setDisabled(gold < cost);
      }
    }
  }
}
