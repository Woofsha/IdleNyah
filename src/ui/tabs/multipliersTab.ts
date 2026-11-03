// src/ui/tabs/multipliersTab.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameSimulation } from '../../core/simulation';
import { NYAH_MULTIPLIERS } from '../../core/multipliers';
import { calculateSingleCost } from '../../core/math';
import type { UiCallbacks } from '../types';
import { PixelButton } from '../components/pixelButton';
import { PixelPanel } from '../components/pixelPanel';

interface MultiplierCardViews {
  cardPanel: PixelPanel;
  nameText: Text;
  levelBadge: Text;
  effectText: Text;
  descText: Text;
  buyBtn: PixelButton;
  id: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: number; textColor: string }> = {
  fifi_boost: { label: 'CHORE BOOST', color: 0x4a2a6e, textColor: '#e1bee7' },
  global_gold: { label: 'GLOBAL GOLD', color: 0x6e4a1a, textColor: '#ffe082' },
  click_power: { label: 'CLICK & FRENZY', color: 0x2e5a32, textColor: '#c8e6c9' },
  compound: { label: 'ESTATE COMPOUND', color: 0x1f4e79, textColor: '#bbdefb' },
};

export class MultipliersTab extends Container {
  private simulation: GameSimulation;
  private callbacks: UiCallbacks;
  private cardViews: MultiplierCardViews[] = [];

  constructor(simulation: GameSimulation, callbacks: UiCallbacks = {}) {
    super();
    this.simulation = simulation;
    this.callbacks = callbacks;

    const cardWidth = 896;
    const cardHeight = 64;

    NYAH_MULTIPLIERS.forEach((mult, index) => {
      const cardY = 12 + index * 70;
      const cardContainer = new Container();
      cardContainer.position.set(22, cardY);

      const cardPanel = new PixelPanel({
        width: cardWidth,
        height: cardHeight,
        fillColor: 0x1a162b,
        strokeColor: 0x463866,
        radius: 4,
      });
      cardContainer.addChild(cardPanel);

      // Category Pill Badge
      const catConfig = CATEGORY_LABELS[mult.category] ?? { label: 'MULTIPLIER', color: 0x332a48, textColor: '#ffffff' };
      const catBadge = new Graphics();
      catBadge.roundRect(12, 10, 110, 20, 10);
      catBadge.fill({ color: catConfig.color, alpha: 0.9 });
      catBadge.stroke({ color: 0x69548a, width: 1 });
      cardContainer.addChild(catBadge);

      const catText = new Text({
        text: catConfig.label,
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 9,
          fontWeight: 'bold',
          fill: catConfig.textColor,
          align: 'center',
        }),
      });
      catText.anchor.set(0.5, 0.5);
      catText.position.set(67, 20);
      cardContainer.addChild(catText);

      // Name
      const nameText = new Text({
        text: mult.name,
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 13,
          fontWeight: 'bold',
          fill: '#ffffff',
        }),
        x: 132,
        y: 11,
      });
      cardContainer.addChild(nameText);

      // Level Badge
      const levelBadge = new Text({
        text: 'Lv. 0',
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#ffd54f',
        }),
        x: 132 + nameText.width + 10,
        y: 12,
      });
      cardContainer.addChild(levelBadge);

      // Effect Text
      const effectText = new Text({
        text: 'Multiplier: 1.00x',
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#81c784',
        }),
        x: 520,
        y: 12,
      });
      cardContainer.addChild(effectText);

      // Description
      const descText = new Text({
        text: mult.description,
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 10,
          fill: '#b8b0cf',
        }),
        x: 132,
        y: 36,
      });
      cardContainer.addChild(descText);

      // Buy Button: 120x46 at x = 760, y = 9
      const buyBtn = new PixelButton({
        width: 120,
        height: 46,
        text: 'Buy Lv. 1',
        subText: `${mult.baseCost}g`,
        variant: 'purple',
        fontSize: 11,
        subFontSize: 10,
        onClick: () => {
          const success = this.simulation.buyMultiplier(mult.id);
          if (success) {
            this.callbacks.playSfx?.('upgrade');
            this.update();
          }
        },
      });
      buyBtn.position.set(760, 9);
      cardContainer.addChild(buyBtn);

      this.addChild(cardContainer);

      this.cardViews.push({
        cardPanel,
        nameText,
        levelBadge,
        effectText,
        descText,
        buyBtn,
        id: mult.id,
      });
    });

    this.update();
  }

  public update(): void {
    const state = this.simulation.getState();
    const gold = state.currencies.gold;

    for (const card of this.cardViews) {
      const mult = NYAH_MULTIPLIERS.find((m) => m.id === card.id);
      if (!mult) continue;

      const mState = state.multipliers[mult.id];
      const curLevel = mState?.level ?? 0;
      const multVal = mState?.multiplierValue ?? 1.0;

      card.levelBadge.text = `Lv. ${curLevel}`;
      card.levelBadge.x = card.nameText.x + card.nameText.width + 8;

      if (curLevel === 0) {
        card.effectText.text = `Base: 1.00x`;
      } else {
        card.effectText.text = `Current: ${multVal.toFixed(2)}x`;
      }

      const nextCost = calculateSingleCost(mult.baseCost, mult.costRatio, curLevel);
      card.buyBtn.setText(`Buy Lv.${curLevel + 1}`, `${Math.floor(nextCost).toLocaleString()}g`);
      card.buyBtn.setDisabled(gold < nextCost);
    }
  }
}
