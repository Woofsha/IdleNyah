// src/ui/tabs/territoryTab.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameSimulation } from '../../core/simulation';
import { TERRITORY_ZONES, checkZoneUnlockPrerequisites, findZone } from '../../core/territory';
import type { UiCallbacks } from '../types';
import { PixelButton } from '../components/pixelButton';
import { PixelPanel } from '../components/pixelPanel';

export class TerritoryTab extends Container {
  private simulation: GameSimulation;
  private callbacks: UiCallbacks;

  // Left panel views
  private tierTitleText: Text;
  private zoneItems: { checkText: Text; nameText: Text; zoneId: string }[] = [];
  private bonusText: Text;

  // Right panel views
  private nextTargetTitle: Text;
  private nextDescText: Text;
  private nextHabitatText: Text;
  private reqGoldText: Text;
  private reqTreatsText: Text;
  private reqEssenceText: Text;
  private reqChoresText: Text;
  private expandBtn: PixelButton;

  constructor(simulation: GameSimulation, callbacks: UiCallbacks = {}) {
    super();
    this.simulation = simulation;
    this.callbacks = callbacks;

    const leftPanel = new PixelPanel({
      width: 426,
      height: 290,
      fillColor: 0x1b172c,
      strokeColor: 0x3d355c,
      radius: 4,
    });
    leftPanel.position.set(16, 10);
    this.addChild(leftPanel);

    const rightPanel = new PixelPanel({
      width: 466,
      height: 290,
      fillColor: 0x1b172c,
      strokeColor: 0x3d355c,
      radius: 4,
    });
    rightPanel.position.set(454, 10);
    this.addChild(rightPanel);

    // Left Panel contents
    this.tierTitleText = new Text({
      text: 'Current Estate: Tier 1',
      style: new TextStyle({
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 13,
        fontWeight: 'bold',
        fill: '#ffd54f',
      }),
      x: 30,
      y: 22,
    });
    this.addChild(this.tierTitleText);

    // Unlocked Zones List
    TERRITORY_ZONES.forEach((zone, index) => {
      const rowY = 52 + index * 32;

      const checkText = new Text({
        text: '[✓]',
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#81c784',
        }),
        x: 30,
        y: rowY,
      });

      const nameText = new Text({
        text: `T${zone.tier}: ${zone.name}`,
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 11,
          fill: '#ffffff',
        }),
        x: 60,
        y: rowY,
      });

      this.addChild(checkText, nameText);
      this.zoneItems.push({ checkText, nameText, zoneId: zone.id });
    });

    this.bonusText = new Text({
      text: 'Territory Multipliers: Gold x1.00 | Essence x1.00 | Click x1.00',
      style: new TextStyle({
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 10,
        fill: '#9fa8da',
      }),
      x: 30,
      y: 268,
    });
    this.addChild(this.bonusText);

    // Right Panel contents
    const nextHeader = new Text({
      text: 'NEXT EXPANSION TARGET',
      style: new TextStyle({
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#ffd54f',
      }),
      x: 472,
      y: 22,
    });
    this.addChild(nextHeader);

    this.nextTargetTitle = new Text({
      text: 'Tier 2: Country Kitchen & Herb Garden',
      style: new TextStyle({
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#ffffff',
      }),
      x: 472,
      y: 44,
    });
    this.addChild(this.nextTargetTitle);

    this.nextDescText = new Text({
      text: 'Sunny garden plots and a warm hearth oven for baking catnip cookies.',
      style: new TextStyle({
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 10,
        fill: '#c5cae9',
        wordWrap: true,
        wordWrapWidth: 430,
      }),
      x: 472,
      y: 66,
    });
    this.addChild(this.nextDescText);

    this.nextHabitatText = new Text({
      text: 'Habitat: Herb Garden Pen (Capacity: 4)',
      style: new TextStyle({
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: '#81c784',
      }),
      x: 472,
      y: 104,
    });
    this.addChild(this.nextHabitatText);

    // Requirements Checklist
    const reqHeader = new Text({
      text: 'Prerequisites Checklist:',
      style: new TextStyle({
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 11,
        fontWeight: 'bold',
        fill: '#ffcc80',
      }),
      x: 472,
      y: 128,
    });
    this.addChild(reqHeader);

    const checklistStyle = new TextStyle({
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: 11,
      fill: '#ffffff',
    });

    this.reqGoldText = new Text({ text: '• Gold: 0 / 500', style: checklistStyle, x: 480, y: 148 });
    this.reqTreatsText = new Text({ text: '• Treats: 0 / 0', style: checklistStyle, x: 480, y: 168 });
    this.reqEssenceText = new Text({ text: '• Essence: 0 / 0', style: checklistStyle, x: 480, y: 188 });
    this.reqChoresText = new Text({ text: '• Chores: 0 / 25', style: checklistStyle, x: 480, y: 208 });
    this.addChild(this.reqGoldText, this.reqTreatsText, this.reqEssenceText, this.reqChoresText);

    // Expand Button: 220x46 at x = 574, y = 236
    this.expandBtn = new PixelButton({
      width: 220,
      height: 44,
      text: 'EXPAND TERRITORY',
      variant: 'green',
      fontSize: 12,
      onClick: () => {
        const nextZone = this.getNextLockedZone();
        if (nextZone) {
          const success = this.simulation.unlockTerritory(nextZone.id);
          if (success) {
            this.callbacks.playSfx?.('fanfare');
            this.update();
          }
        }
      },
    });
    this.expandBtn.position.set(574, 236);
    this.addChild(this.expandBtn);

    this.update();
  }

  private getNextLockedZone() {
    const unlocked = this.simulation.getState().territory.unlockedZones;
    return TERRITORY_ZONES.find((z) => !unlocked.includes(z.id));
  }

  public update(): void {
    const state = this.simulation.getState();
    const unlocked = state.territory.unlockedZones;
    const curTier = state.territory.currentTier;
    const curZone = TERRITORY_ZONES.find((z) => z.tier === curTier);

    this.tierTitleText.text = `Current Estate: Tier ${curTier} (${curZone?.name ?? 'Estate'})`;

    // Multipliers summary
    let goldMult = 1.0;
    let essenceMult = 1.0;
    let clickMult = 1.0;

    for (const item of this.zoneItems) {
      const isUnlocked = unlocked.includes(item.zoneId);
      item.checkText.text = isUnlocked ? '[✓]' : '[ ]';
      item.checkText.style.fill = isUnlocked ? '#81c784' : '#616161';
      item.nameText.style.fill = isUnlocked ? '#ffffff' : '#757575';

      if (isUnlocked) {
        const z = findZone(item.zoneId);
        if (z?.productionBonus?.goldMultiplier) goldMult *= z.productionBonus.goldMultiplier;
        if (z?.productionBonus?.essenceMultiplier) essenceMult *= z.productionBonus.essenceMultiplier;
        if (z?.productionBonus?.clickMultiplier) clickMult *= z.productionBonus.clickMultiplier;
      }
    }

    this.bonusText.text = `Territory Multipliers: Gold x${goldMult.toFixed(2)} | Essence x${essenceMult.toFixed(2)} | Click x${clickMult.toFixed(2)}`;

    // Next Target
    const nextZone = this.getNextLockedZone();
    if (!nextZone) {
      this.nextTargetTitle.text = 'MAX TERRITORY REACHED';
      this.nextDescText.text = 'Your estate extends from the celestial terrace into infinity!';
      this.nextHabitatText.text = 'All 5 Habitats Unlocked (Total Capacity: 29 creatures)';
      this.reqGoldText.text = '• Gold: Complete';
      this.reqTreatsText.text = '• Treats: Complete';
      this.reqEssenceText.text = '• Essence: Complete';
      this.reqChoresText.text = '• Chores: Complete';
      this.expandBtn.setText('ALL ZONES UNLOCKED');
      this.expandBtn.setDisabled(true);
      return;
    }

    this.nextTargetTitle.text = `Tier ${nextZone.tier}: ${nextZone.name}`;
    this.nextDescText.text = nextZone.description;
    this.nextHabitatText.text = `Unlocks Habitat: ${nextZone.habitatName} (Capacity: ${nextZone.habitatCapacity})`;

    const gold = Math.floor(state.currencies.gold);
    const treats = Math.floor(state.currencies.treats);
    const essence = Math.floor(state.currencies.essence);
    const totalClicks = state.clickStats.totalClicks;

    const goldMet = gold >= nextZone.costGold;
    this.reqGoldText.text = `${goldMet ? '✓' : '✗'} Gold: ${gold.toLocaleString()} / ${nextZone.costGold.toLocaleString()}`;
    this.reqGoldText.style.fill = goldMet ? '#81c784' : '#ef5350';

    if (nextZone.costTreats > 0) {
      const treatsMet = treats >= nextZone.costTreats;
      this.reqTreatsText.text = `${treatsMet ? '✓' : '✗'} Treats: ${treats} / ${nextZone.costTreats}`;
      this.reqTreatsText.style.fill = treatsMet ? '#81c784' : '#ef5350';
      this.reqTreatsText.visible = true;
    } else {
      this.reqTreatsText.text = '✓ Treats: None required';
      this.reqTreatsText.style.fill = '#81c784';
      this.reqTreatsText.visible = true;
    }

    if (nextZone.costEssence > 0) {
      const essenceMet = essence >= nextZone.costEssence;
      this.reqEssenceText.text = `${essenceMet ? '✓' : '✗'} Essence: ${essence} / ${nextZone.costEssence}`;
      this.reqEssenceText.style.fill = essenceMet ? '#81c784' : '#ef5350';
      this.reqEssenceText.visible = true;
    } else {
      this.reqEssenceText.text = '✓ Essence: None required';
      this.reqEssenceText.style.fill = '#81c784';
      this.reqEssenceText.visible = true;
    }

    if (nextZone.prerequisiteChores) {
      const choresMet = totalClicks >= nextZone.prerequisiteChores;
      this.reqChoresText.text = `${choresMet ? '✓' : '✗'} Chores: ${totalClicks} / ${nextZone.prerequisiteChores}`;
      this.reqChoresText.style.fill = choresMet ? '#81c784' : '#ef5350';
      this.reqChoresText.visible = true;
    } else {
      this.reqChoresText.text = '✓ Chores: None required';
      this.reqChoresText.style.fill = '#81c784';
      this.reqChoresText.visible = true;
    }

    const check = checkZoneUnlockPrerequisites(nextZone, unlocked, totalClicks, state.currencies);
    this.expandBtn.setText(`EXPAND TO TIER ${nextZone.tier}`);
    this.expandBtn.setDisabled(!check.canUnlock);
  }
}
