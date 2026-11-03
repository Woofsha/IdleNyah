// src/main.ts
import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import { GameSimulation } from './core/simulation';
import { createPixiApp } from './render/app';
import { loadGameAssets } from './render/assets';
import { WorldView } from './render/world';
import { getAudioEngine } from './audio';
import {
  HudDrawer,
  SpeechBubble,
  StoryModal,
  TitleMenu,
  OptionsModal,
  NYAH_AMBIENT_QUOTES,
  FIFI_AMBIENT_QUOTES,
  getNextPendingMilestone,
} from './ui';

const TIER_NAMES: Record<number, string> = {
  1: 'Starter Cottage',
  2: 'Country Villa',
  3: 'Grand Manor',
  4: 'Royal Balcony',
  5: 'Celestial Chateau',
};

/**
 * Boots the IdleNyah application: initializes PixiJS v8, loads assets,
 * spins up the pure simulation engine, audio synthesizer, and links the render loop.
 */
async function bootstrap(): Promise<void> {
  // Ensure pixel fonts are fully loaded before rendering canvas text
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue even if offline
    }
  }

  const container = document.getElementById('app-container');
  if (!container) {
    throw new Error('DOM container #app-container not found.');
  }

  const loadingOverlay = document.getElementById('loading-overlay');

  try {
    // 1. Initialize PixiJS v8 Application
    const app = await createPixiApp({
      container,
      width: 960,
      height: 640,
      background: '#14121e',
    });

    // 2. Load game assets (textures & sliced frames)
    const assets = await loadGameAssets('./assets/');

    // 3. Initialize Pure TypeScript Simulation Engine
    const simulation = new GameSimulation({
      seed: Date.now(),
    });

    // Load save data from persistent local storage if present
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('idle_nyah_save_v1');
        if (saved) {
          simulation.loadSaveData(saved);
        }
      } catch {
        // Fall back gracefully to clean state if save corrupted
      }
    }

    // 4. Initialize Zero-Dependency Cozy Web Audio Engine
    const simSettings = simulation.getState().settings;
    const audio = getAudioEngine({
      masterVolume: simSettings.masterVolume,
      bgmVolume: simSettings.bgmVolume,
      sfxVolume: simSettings.sfxVolume,
      muted: simSettings.muted,
      onSettingsChange: (settings) => {
        simulation.updateAudioSettings(settings);
      },
    });
    await audio.init();
    audio.startBgm();

    // 5. Fixed Pixel-Art HUD Overlay Container (added to stage after worldView)
    const uiContainer = new Container({
      label: 'ui-container',
      zIndex: 100,
    });

    // Top HUD bar background
    const hudBar = new Graphics();
    hudBar.rect(0, 0, 960, 42);
    hudBar.fill({ color: 0x161324, alpha: 0.92 });
    hudBar.stroke({ color: 0x362f4b, width: 2 });
    hudBar.eventMode = 'static';
    hudBar.on('pointerdown', (e) => e.stopPropagation());
    uiContainer.addChild(hudBar);

    // Top HUD Floating Translucent Pill Bar
    const topBarBg = new Graphics();
    topBarBg.roundRect(8, 6, 944, 30, 15);
    topBarBg.fill({ color: 0x120d20, alpha: 0.82 });
    topBarBg.stroke({ color: 0x854d0e, width: 1.2 });
    // Subtle top highlight
    topBarBg.roundRect(10, 7, 940, 12, 10);
    topBarBg.stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
    uiContainer.addChild(topBarBg);

    // HUD Text styles with crisp dark pixel outlines
    const hudStyle = new TextStyle({
      fontFamily: '"Silkscreen", "Courier New", monospace',
      fontSize: 10,
      fontWeight: 'bold',
      fill: '#f1f5f9',
      stroke: { color: 0x070511, width: 2.5 },
    });

    const goldText = new Text({
      text: 'Gold: 0 (0/s)',
      style: hudStyle,
      resolution: 2,
      x: 24,
      y: 13,
    });

    const treatsText = new Text({
      text: 'Treats: 0',
      style: new TextStyle({
        ...hudStyle,
        fill: '#fbbf24',
      }),
      resolution: 2,
      x: 175,
      y: 13,
    });

    const territoryText = new Text({
      text: 'Estate: T1 - Starter Cottage',
      style: new TextStyle({
        ...hudStyle,
        fill: '#86efac',
      }),
      resolution: 2,
      x: 295,
      y: 13,
    });

    const frenzyText = new Text({
      text: '',
      style: new TextStyle({
        ...hudStyle,
        fill: '#c084fc',
      }),
      resolution: 2,
      x: 540,
      y: 13,
    });
    frenzyText.anchor.set(0.5, 0);

    const helpText = new Text({
      text: '[F: Fullscreen]',
      style: new TextStyle({
        fontFamily: '"Silkscreen", "Courier New", monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: '#94a3b8',
        stroke: { color: 0x070511, width: 2 },
      }),
      resolution: 2,
      x: 815,
      y: 13,
    });
    helpText.anchor.set(1, 0);

    const optionsBtn = new Text({
      text: '[Options / Menu]',
      style: new TextStyle({
        fontFamily: '"Silkscreen", "Courier New", monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: '#ffd45e',
        stroke: { color: 0x070511, width: 2 },
      }),
      resolution: 2,
      x: 938,
      y: 13,
    });
    optionsBtn.anchor.set(1, 0);
    optionsBtn.eventMode = 'static';
    optionsBtn.cursor = 'pointer';

    // Toggle fullscreen on F key
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      });
    }

    uiContainer.addChild(goldText, treatsText, territoryText, frenzyText, helpText, optionsBtn);

    // 6. Speech Bubbles for Nyah & Fifi (Tier 1 Ambient Dialogue)
    let nyahBubble: SpeechBubble;
    let fifiBubble: SpeechBubble;

    // 7. Initialize 2D Pixel World View
    const worldView = new WorldView({
      app,
      assets,
      simulation,
      onWorldClick: (worldX, worldY) => {
        // Active click mechanics
        const clickResult = simulation.handleClick();
        const { goldEarned, isCrit, frenzyTriggered } = clickResult;

        // Spawn floating text and sparkle particles in world space
        if (frenzyTriggered) {
          audio.playSfx('frenzy');
          const quotes = NYAH_AMBIENT_QUOTES.frenzy;
          nyahBubble.show(quotes[Math.floor(Math.random() * quotes.length)], 4.0);

          worldView.effectsManager.spawnFloatingText({
            text: 'TSUNDERE FRENZY! 3x',
            x: worldX,
            y: worldY - 20,
            color: '#a97bff',
            fontSize: 22,
            isCrit: true,
          });
        } else {
          audio.playSfx(isCrit ? 'coin' : 'click');
          worldView.effectsManager.spawnFloatingText({
            text: isCrit ? `CRIT! +${goldEarned}g` : `+${goldEarned}g`,
            x: worldX,
            y: worldY,
            color: isCrit ? '#ffdd44' : '#ffffff',
            fontSize: isCrit ? 18 : 14,
            isCrit,
          });
        }

        worldView.effectsManager.spawnSparkles({
          x: worldX,
          y: worldY,
          count: isCrit ? 10 : 5,
          color: isCrit ? 0xffeb3b : 0xffffff,
        });
      },
      onStructureClick: (structureType, worldX, worldY) => {
        // Interactive estate structure clicks
        const clickResult = simulation.handleClick();
        const { goldEarned, isCrit } = clickResult;

        audio.playSfx(isCrit ? 'coin' : 'click');

        let label = 'Estate Maintained';
        let color = '#ffdd44';
        let particleColor = 0xffeb3b;

        if (structureType === 'mansion') {
          label = isCrit ? 'Palace Polished!' : 'Mansion Cleaned';
          color = isCrit ? '#ffdd44' : '#a97bff';
          particleColor = isCrit ? 0xffeb3b : 0xa97bff;
          worldView.maidNyah.setState('chore');
        } else if (structureType === 'fountain') {
          label = 'Wishing Fountain';
          color = '#4fc3f7';
          particleColor = 0x29b6f6;
          worldView.maidFifi.setState('chore');
        } else if (structureType === 'garden') {
          label = 'Herbs Harvested';
          color = '#81c784';
          particleColor = 0x66bb6a;
          worldView.maidFifi.setState('chore');
        } else if (structureType === 'library') {
          label = 'Ancient Lore Studied';
          color = '#ba68c8';
          particleColor = 0xab47bc;
          worldView.maidNyah.setState('chore');
        } else if (structureType === 'observatory') {
          label = 'Starlight Charted';
          color = '#fff176';
          particleColor = 0xffd54f;
          worldView.maidNyah.setState('chore');
        }

        worldView.effectsManager.spawnFloatingText({
          text: isCrit ? `CRIT! +${goldEarned}g [${label}]` : `+${goldEarned}g [${label}]`,
          x: worldX,
          y: worldY,
          color,
          fontSize: isCrit ? 18 : 14,
          isCrit,
        });

        worldView.effectsManager.spawnSparkles({
          x: worldX,
          y: worldY,
          count: isCrit ? 12 : 6,
          color: particleColor,
        });
      },
      onCatchCreature: (wildInstanceId, useBait) => {
        const result = simulation.attemptCatchCreature(wildInstanceId, useBait);
        if (result.success) {
          audio.playSfx('catch');
          const quotes = Math.random() < 0.5 ? NYAH_AMBIENT_QUOTES.catch : FIFI_AMBIENT_QUOTES.catch;
          const quote = quotes[Math.floor(Math.random() * quotes.length)];
          if (Math.random() < 0.5) {
            nyahBubble.show(quote, 3.5);
          } else {
            fifiBubble.show(quote, 3.5);
          }
        }
        return result;
      },
    });

    // Synchronize initial territory state
    worldView.setUnlockedZones(simulation.getState().territory.unlockedZones, false);

    // Initialize speech bubbles anchored to maids
    nyahBubble = new SpeechBubble({
      speaker: 'nyah',
      getAnchorPos: () => worldView.maidNyah.getSpeechAnchorWorld(),
    });

    fifiBubble = new SpeechBubble({
      speaker: 'fifi',
      getAnchorPos: () => worldView.maidFifi.getSpeechAnchorWorld(),
    });

    uiContainer.addChild(nyahBubble, fifiBubble);

    // Maid click interactions
    worldView.maidNyah.setClickHandler(() => {
      const clickResult = simulation.handleClick();
      audio.playSfx('petting');
      const quotes = NYAH_AMBIENT_QUOTES.click;
      const quote = quotes[Math.floor(Math.random() * quotes.length)];
      nyahBubble.show(quote, 3.5);

      worldView.effectsManager.spawnFloatingText({
        text: `+${clickResult.goldEarned}g`,
        x: worldView.maidNyah.x,
        y: worldView.maidNyah.y - 40,
        color: '#a97bff',
        fontSize: 16,
        isCrit: true,
      });
      worldView.effectsManager.spawnSparkles({
        x: worldView.maidNyah.x,
        y: worldView.maidNyah.y - 20,
        count: 8,
        color: 0xa97bff,
      });
    });

    worldView.maidFifi.setClickHandler(() => {
      const clickResult = simulation.handleClick();
      audio.playSfx('petting');
      const quotes = FIFI_AMBIENT_QUOTES.click;
      const quote = quotes[Math.floor(Math.random() * quotes.length)];
      fifiBubble.show(quote, 3.5);

      worldView.effectsManager.spawnFloatingText({
        text: `+${clickResult.goldEarned}g`,
        x: worldView.maidFifi.x,
        y: worldView.maidFifi.y - 40,
        color: '#c98a52',
        fontSize: 16,
        isCrit: false,
      });
      worldView.effectsManager.spawnSparkles({
        x: worldView.maidFifi.x,
        y: worldView.maidFifi.y - 20,
        count: 6,
        color: 0xc98a52,
      });
    });

    // 8. Bottom Slide Drawer Panel (Feature 21)
    const hudDrawer = new HudDrawer({
      simulation,
      audio,
      callbacks: {
        playSfx: (type) => audio.playSfx(type),
      },
    });
    uiContainer.addChild(hudDrawer);

    // 9. Story Progression Modal (Tier 2 Dialogue System)
    const storyModal = new StoryModal({
      nyahPortrait: assets.nyahPortraitNative,
      fifiPortrait: assets.fifiPortraitNative,
      callbacks: {
        playSfx: (type) => audio.playSfx(type),
      },
    });
    uiContainer.addChild(storyModal);

    // 9b. Diorama Screen-Space Atmosphere & Vignette Layer (soft framing & warm grading)
    const dioramaAtmosphere = new Container({
      label: 'diorama-atmosphere',
      zIndex: 50,
      eventMode: 'none',
    });

    const vignette = new Graphics();
    vignette.rect(0, 0, 960, 640);
    vignette.stroke({ color: 0x0c0916, width: 24, alpha: 0.35 });
    vignette.roundRect(4, 4, 952, 632, 28);
    vignette.stroke({ color: 0x0c0916, width: 14, alpha: 0.25 });
    dioramaAtmosphere.addChild(vignette);

    const grading = new Graphics();
    grading.blendMode = 'add';
    grading.circle(880, 80, 260).fill({ color: 0xfef08a, alpha: 0.05 });
    dioramaAtmosphere.addChild(grading);

    // Ensure stage obeys zIndex and UI is rendered on top of the world
    app.stage.sortableChildren = true;
    worldView.worldContainer.zIndex = 0;
    dioramaAtmosphere.zIndex = 50;
    uiContainer.zIndex = 100;
    app.stage.addChild(dioramaAtmosphere, uiContainer);

    // 10. Title Menu Overlay with Procedural Wind-Swaying Forest & Roaming Creatures
    const titleMenu = new TitleMenu({
      container,
      estateTier: simulation.getState().territory.currentTier,
      isMuted: audio.getSettings().muted,
      onPlay: () => {
        // Continue to game view
      },
      onNewGame: () => {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.removeItem('idle_nyah_save_v1');
          } catch {}
        }
        simulation.reset();
        hudDrawer.refreshActiveTab();
        worldView.estateView.updateMansionTier(1);
        worldView.setUnlockedZones(Array.from(simulation.getState().territory.unlockedZones));
        titleMenu.updateTier(1);
      },
      onToggleSound: () => {
        return audio.toggleMute();
      },
      onToggleFullscreen: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      },
    });

    // 11. In-Game Options Modal with Sound, Graphics, and Main Menu Return
    const optionsModal = new OptionsModal({
      container,
      audio,
      onReturnToMainMenu: () => {
        optionsModal.hide();
        titleMenu.updateTier(simulation.getState().territory.currentTier);
        titleMenu.show();
      },
      onToggleFullscreen: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      },
      onToggleWindSway: (enabled) => {
        worldView.estateView.setWindSwayEnabled(enabled);
      },
      onToggleFireflies: (enabled) => {
        worldView.estateView.setFirefliesEnabled(enabled);
      },
      onToggleVignette: (enabled) => {
        worldView.estateView.setVolumetricLightEnabled(enabled);
      },
      onSoundChange: (settings) => {
        simulation.updateAudioSettings(settings);
      },
    });

    optionsBtn.on('pointerdown', (e) => {
      e.stopPropagation();
      optionsModal.show();
    });

    // Toggle options with Escape or O key
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') {
          if (!titleMenu.isVisible) {
            optionsModal.toggle();
          }
        }
      });
    }

    const completedMilestones = new Set<string>();

    // 10. Connect PixiJS Ticker to simulation loop
    let autoSaveTimer = 0;
    let idleBubbleTimer = 0;
    let nextIdleInterval = 18;
    let lastUnlockedZonesKey = '';

    app.ticker.add((ticker) => {
      const deltaMs = ticker.deltaMS;
      const deltaSeconds = deltaMs / 1000;

      // Advance deterministic simulation state
      simulation.tick(deltaMs);

      // Check for territory unlock state changes
      const state = simulation.getState();
      const unlockedKey = state.territory.unlockedZones.slice().sort().join(',');
      if (unlockedKey !== lastUnlockedZonesKey) {
        if (lastUnlockedZonesKey !== '') {
          audio.playSfx('fanfare');
        }
        lastUnlockedZonesKey = unlockedKey;
        worldView.setUnlockedZones(state.territory.unlockedZones, true);
      }

      // Check for pending story progression cutscene
      if (!storyModal.isShowing()) {
        const pending = getNextPendingMilestone(state, completedMilestones);
        if (pending) {
          completedMilestones.add(pending.id);
          storyModal.playSequence(pending);
        }
      }

      // Idle ambient speech bubble timer (15-30 seconds)
      idleBubbleTimer += deltaSeconds;
      if (idleBubbleTimer >= nextIdleInterval) {
        idleBubbleTimer = 0;
        nextIdleInterval = 15 + Math.random() * 15;
        if (!nyahBubble.visible && !fifiBubble.visible && !storyModal.isShowing()) {
          if (Math.random() < 0.5) {
            const q = NYAH_AMBIENT_QUOTES.idle[Math.floor(Math.random() * NYAH_AMBIENT_QUOTES.idle.length)];
            nyahBubble.show(q, 3.5);
          } else {
            const q = FIFI_AMBIENT_QUOTES.idle[Math.floor(Math.random() * FIFI_AMBIENT_QUOTES.idle.length)];
            fifiBubble.show(q, 3.5);
          }
        }
      }

      // Update UI components
      hudDrawer.update(deltaSeconds);
      nyahBubble.update(deltaSeconds);
      fifiBubble.update(deltaSeconds);
      storyModal.update(deltaSeconds);

      // Advance 2D world rendering
      worldView.update(deltaSeconds, state);

      // Update HUD display
      const gold = Math.floor(state.currencies.gold);
      const gps = Math.floor(simulation.getTotalGPS());
      goldText.text = `Gold: ${gold.toLocaleString()} (${gps.toLocaleString()}/s)`;

      const treats = Math.floor(state.currencies.treats);
      treatsText.text = `Treats: ${treats.toLocaleString()}`;

      const tier = state.territory.currentTier;
      const tierName = TIER_NAMES[tier] ?? `Tier ${tier}`;
      territoryText.text = `Estate: T${tier} - ${tierName}`;

      if (state.clickStats.frenzyActive) {
        const remaining = Math.ceil(state.clickStats.frenzyTimeRemaining);
        frenzyText.text = `FRENZY 3x! (${remaining}s)`;
        frenzyText.visible = true;
        helpText.visible = false;
      } else {
        frenzyText.visible = false;
        helpText.visible = true;
      }

      // Auto-save every 15 seconds
      autoSaveTimer += deltaSeconds;
      if (autoSaveTimer >= 15) {
        autoSaveTimer = 0;
        try {
          const saveJson = simulation.getSaveData();
          localStorage.setItem('idle_nyah_save_v1', saveJson);
        } catch {
          // Ignore localStorage errors in restricted environments
        }
      }
    });

    // Expose runtime instance for debugging and tests
    if (typeof window !== 'undefined') {
      (window as any).__idleNyah = {
        simulation,
        worldView,
        app,
        audio,
        hudDrawer,
        storyModal,
        titleMenu,
        optionsModal,
      };
    }

    // 11. Hide loading overlay and present Main Menu
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
    titleMenu.show();

    console.log('[IdleNyah] Successfully initialized PixiJS v8 Engine, UI Drawer, Audio and Story Dialogue.');
  } catch (err) {
    console.error('[IdleNyah] Initialization failed:', err);
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `<div style="color:#ff6b6b;font-size:18px;">Failed to load IdleNyah: ${String(err)}</div>`;
    }
  }
}

// Start application after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch(console.error);
  });
} else {
  bootstrap().catch(console.error);
}
