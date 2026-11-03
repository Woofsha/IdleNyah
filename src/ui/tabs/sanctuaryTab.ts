// src/ui/tabs/sanctuaryTab.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameSimulation } from '../../core/simulation';
import { CREATURE_SPECIES, HABITATS } from '../../core/creatures';
import type { UiCallbacks } from '../types';
import { PixelButton } from '../components/pixelButton';
import { PixelPanel } from '../components/pixelPanel';

interface SpeciesCardViews {
  cardPanel: PixelPanel;
  nameText: Text;
  tierBadge: Text;
  caughtText: Text;
  shinyText: Text;
  habitatText: Text;
  assignBtn: PixelButton;
  id: string;
}

const TIER_COLORS: Record<string, { bg: number; text: string }> = {
  common: { bg: 0x37474f, text: '#cfd8dc' },
  uncommon: { bg: 0x00695c, text: '#80cbc4' },
  rare: { bg: 0x4a148c, text: '#ce93d8' },
  mythic: { bg: 0xf57f17, text: '#fff59d' },
};

export class SanctuaryTab extends Container {
  private simulation: GameSimulation;
  private callbacks: UiCallbacks;

  private habitatSummaryTexts: Text[] = [];
  private cardViews: SpeciesCardViews[] = [];

  constructor(simulation: GameSimulation, callbacks: UiCallbacks = {}) {
    super();
    this.simulation = simulation;
    this.callbacks = callbacks;

    // 1. Habitat Summary Header: y = 8, height = 30
    const headerPanel = new PixelPanel({
      width: 896,
      height: 32,
      fillColor: 0x171424,
      strokeColor: 0x3d355b,
      radius: 4,
    });
    headerPanel.position.set(22, 6);
    this.addChild(headerPanel);

    let habX = 32;
    HABITATS.forEach((hab, idx) => {
      const habText = new Text({
        text: `${hab.name.split(' ')[0]}: 0/${hab.capacity}`,
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 10,
          fontWeight: 'bold',
          fill: '#b3a9d4',
        }),
        x: habX,
        y: 15,
      });
      this.addChild(habText);
      this.habitatSummaryTexts.push(habText);
      habX += 175;
    });

    // 2. 10 Species Cards in 2 columns x 5 rows
    // Col 0: x = 22, Col 1: x = 478. Row height = 50, spacing = 52. y starts at 44.
    const cardWidth = 440;
    const cardHeight = 48;

    CREATURE_SPECIES.forEach((spec, index) => {
      const col = index < 5 ? 0 : 1;
      const row = index % 5;
      const cardX = col === 0 ? 22 : 478;
      const cardY = 44 + row * 52;

      const cardContainer = new Container();
      cardContainer.position.set(cardX, cardY);

      const cardPanel = new PixelPanel({
        width: cardWidth,
        height: cardHeight,
        fillColor: 0x1d1930,
        strokeColor: 0x3e355c,
        radius: 4,
      });
      cardContainer.addChild(cardPanel);

      // Tier badge pill
      const tierConfig = TIER_COLORS[spec.tier] ?? { bg: 0x222222, text: '#ffffff' };
      const badgeG = new Graphics();
      badgeG.roundRect(8, 6, 68, 16, 8);
      badgeG.fill({ color: tierConfig.bg, alpha: 0.9 });
      badgeG.stroke({ color: 0x5a4d7d, width: 1 });
      cardContainer.addChild(badgeG);

      const tierBadge = new Text({
        text: spec.tier.toUpperCase(),
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 8,
          fontWeight: 'bold',
          fill: tierConfig.text,
          align: 'center',
        }),
      });
      tierBadge.anchor.set(0.5, 0.5);
      tierBadge.position.set(42, 14);
      cardContainer.addChild(tierBadge);

      // Name
      const nameText = new Text({
        text: spec.name,
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#ffffff',
        }),
        x: 82,
        y: 6,
      });
      cardContainer.addChild(nameText);

      // Shiny indicator
      const shinyText = new Text({
        text: '★ SHINY',
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 9,
          fontWeight: 'bold',
          fill: '#ffd54f',
        }),
        x: 82 + nameText.width + 8,
        y: 8,
      });
      shinyText.visible = false;
      cardContainer.addChild(shinyText);

      // Caught count & yields
      const caughtText = new Text({
        text: 'Caught: 0',
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 9,
          fill: '#9fa8da',
        }),
        x: 82,
        y: 28,
      });
      cardContainer.addChild(caughtText);

      // Habitat text
      const habDef = HABITATS.find((h) => h.id === spec.preferredHabitatId);
      const habitatText = new Text({
        text: `Hab: ${habDef?.name ?? 'Porch'}`,
        style: new TextStyle({
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 9,
          fill: '#81c784',
        }),
        x: 210,
        y: 28,
      });
      cardContainer.addChild(habitatText);

      // Assign / Recall Button: 86x34 at x = 344, y = 7
      const assignBtn = new PixelButton({
        width: 86,
        height: 34,
        text: 'Assign',
        variant: 'green',
        fontSize: 10,
        onClick: () => {
          const state = this.simulation.getState();
          const cData = state.creatures.caught[spec.id];
          if (!cData || cData.count <= 0) return;

          if (cData.assignedHabitat) {
            // Unassign
            this.simulation.assignCreature(spec.id, '');
            this.callbacks.playSfx?.('click');
          } else {
            // Assign to preferred habitat
            const success = this.simulation.assignCreature(spec.id, spec.preferredHabitatId);
            if (success) {
              this.callbacks.playSfx?.('upgrade');
            }
          }
          this.update();
        },
      });
      assignBtn.position.set(344, 7);
      cardContainer.addChild(assignBtn);

      this.addChild(cardContainer);

      this.cardViews.push({
        cardPanel,
        nameText,
        tierBadge,
        caughtText,
        shinyText,
        habitatText,
        assignBtn,
        id: spec.id,
      });
    });

    this.update();
  }

  public update(): void {
    const state = this.simulation.getState();
    const unlockedZones = state.territory.unlockedZones;

    // Calculate habitat occupancy
    const occupancy: Record<string, number> = {};
    for (const h of HABITATS) occupancy[h.id] = 0;

    for (const [specId, cData] of Object.entries(state.creatures.caught)) {
      if (cData.count > 0 && cData.assignedHabitat && occupancy[cData.assignedHabitat] !== undefined) {
        occupancy[cData.assignedHabitat] += cData.count;
      }
    }

    // Update Header
    HABITATS.forEach((hab, idx) => {
      const isUnlocked = unlockedZones.includes(hab.zoneId);
      const textElem = this.habitatSummaryTexts[idx];
      if (textElem) {
        const occ = occupancy[hab.id] ?? 0;
        if (isUnlocked) {
          textElem.text = `${hab.name.split(' ')[0]}: ${occ}/${hab.capacity}`;
          textElem.style.fill = occ >= hab.capacity ? '#ef5350' : '#81c784';
        } else {
          textElem.text = `${hab.name.split(' ')[0]}: [LOCKED]`;
          textElem.style.fill = '#757575';
        }
      }
    });

    // Update Species Cards
    for (const card of this.cardViews) {
      const spec = CREATURE_SPECIES.find((s) => s.id === card.id);
      if (!spec) continue;

      const cData = state.creatures.caught[spec.id];
      const count = cData?.count ?? 0;
      const shiny = Boolean(cData?.isShiny);
      const assigned = Boolean(cData?.assignedHabitat);

      card.shinyText.visible = shiny;
      card.shinyText.x = card.nameText.x + card.nameText.width + 6;

      if (count > 0) {
        let yieldStr = `+${spec.goldPerSec * count}g/s`;
        if (spec.treatsPerSec > 0) yieldStr += ` +${(spec.treatsPerSec * count).toFixed(2)}t/s`;
        if (spec.essencePerSec > 0) yieldStr += ` +${(spec.essencePerSec * count).toFixed(2)}e/s`;
        card.caughtText.text = `Owned: ${count} (${yieldStr})`;
        card.caughtText.style.fill = '#c5cae9';

        if (assigned) {
          card.assignBtn.setText('Assigned');
          card.assignBtn.setSelected(true);
          card.assignBtn.setDisabled(false);
          card.habitatText.text = `In: ${HABITATS.find((h) => h.id === cData.assignedHabitat)?.name ?? 'Porch'}`;
          card.habitatText.style.fill = '#81c784';
        } else {
          card.assignBtn.setText('Assign');
          card.assignBtn.setSelected(false);
          card.assignBtn.setDisabled(false);
          card.habitatText.text = 'Unassigned';
          card.habitatText.style.fill = '#ffa726';
        }
      } else {
        card.caughtText.text = 'Wild (Uncaught)';
        card.caughtText.style.fill = '#757575';
        card.assignBtn.setText('Uncaught');
        card.assignBtn.setSelected(false);
        card.assignBtn.setDisabled(true);
        card.habitatText.text = `Pref: ${HABITATS.find((h) => h.id === spec.preferredHabitatId)?.name.split(' ')[0]}`;
        card.habitatText.style.fill = '#757575';
      }
    }
  }
}
