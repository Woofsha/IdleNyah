// src/ui/titleMenu.ts
/**
 * Procedural Retro 16-Bit Main Menu & Forest Title Screen for IdleNyah.
 * Features:
 * - 320x180 low-res canvas with pixelated nearest-neighbor upscaling.
 * - Multi-layer atmospheric twilight forest with harmonic depth ridges.
 * - Wind physics: ancient oak branches, pine trees, and foliage clusters sway dynamically in the breeze.
 * - Animated woodland creatures (Bunbun, Astral Fox, Leaflet) wandering across the clearing trail.
 * - Dithered crescent moon halo, drifting fireflies, rolling low-lying mist, and wind-blown leaves.
 * - Responsive retro menu card with Play/Resume, New Game, Audio, and Fullscreen controls.
 */

export interface TitleMenuOptions {
  container: HTMLElement;
  onPlay: () => void;
  onNewGame: () => void;
  onToggleSound: () => boolean;
  onToggleFullscreen: () => void;
  isMuted?: boolean;
  estateTier?: number;
}

interface Star {
  x: number;
  y: number;
  phase: number;
}

interface MidTree {
  x: number;
  h: number;
  w: number;
  phase: number;
  flexibility: number;
  type: 'pine' | 'oak';
}

interface WanderingCreature {
  species: 'bunbun' | 'astral_fox' | 'leaflet';
  x: number;
  y: number;
  targetX: number;
  dir: 1 | -1;
  speed: number;
  state: 'walk' | 'pause';
  animTimer: number;
  pauseTimer: number;
  hopCycle: number;
}

interface Firefly {
  x: number;
  y: number;
  baseX: number;
  vY: number;
  phase: number;
  color: string;
}

interface DriftingLeaf {
  x: number;
  y: number;
  vX: number;
  vY: number;
  rotation: number;
  rotSpeed: number;
  color: string;
}

export class TitleMenu {
  public isVisible = false;

  private container: HTMLElement;
  private menuElement!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  private onPlayCallback: () => void;
  private onNewGameCallback: () => void;
  private onToggleSoundCallback: () => boolean;
  private onToggleFullscreenCallback: () => void;

  private isMuted: boolean;
  private estateTier: number;

  // Animation state
  private animationFrameId: number | null = null;
  private startTime = 0;
  private lastTime = 0;

  // Procedural scene state (320x180 virtual resolution)
  private readonly W = 320;
  private readonly H = 180;

  private stars: Star[] = [];
  private midTrees: MidTree[] = [];
  private fireflies: Firefly[] = [];
  private driftingLeaves: DriftingLeaf[] = [];
  private activeCreatures: WanderingCreature[] = [];
  private nextCreatureSpawnTimer = 3.0;

  constructor(options: TitleMenuOptions) {
    this.container = options.container;
    this.onPlayCallback = options.onPlay;
    this.onNewGameCallback = options.onNewGame;
    this.onToggleSoundCallback = options.onToggleSound;
    this.onToggleFullscreenCallback = options.onToggleFullscreen;
    this.isMuted = options.isMuted ?? false;
    this.estateTier = options.estateTier ?? 1;

    if (typeof document !== 'undefined') {
      this.initDom();
      this.initProceduralScene();
    }
  }

  // =========================================================================
  // DOM Construction
  // =========================================================================
  private initDom(): void {
    // 1. Root Menu Overlay
    this.menuElement = document.createElement('div');
    this.menuElement.id = 'title-menu-overlay';
    this.menuElement.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 150;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #110d1c;
      overflow: hidden;
      opacity: 1;
      transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
      -webkit-user-select: none;
    `;

    // 2. Procedural Pixel Art Canvas (320x180 native with CSS upscale)
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: 50% 100%;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      z-index: 0;
    `;
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
    this.menuElement.appendChild(this.canvas);

    // 3. Cinematic Vignette Overlay
    const vignette = document.createElement('div');
    vignette.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      background: radial-gradient(ellipse at 50% 48%, transparent 40%, rgba(10, 7, 18, 0.72) 100%);
    `;
    this.menuElement.appendChild(vignette);

    // 4. Center Title Card & Menu Panel
    const card = document.createElement('div');
    card.className = 'title-card';
    card.style.cssText = `
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
      max-width: 440px;
      width: 90%;
      margin-top: -10px;
    `;

    // Logo with gold gradient shine
    const logo = document.createElement('div');
    logo.className = 'title-logo';
    logo.textContent = 'IDLENYAH';
    logo.style.cssText = `
      font-family: 'Silkscreen', 'Courier New', monospace;
      font-size: clamp(38px, 6vw, 56px);
      font-weight: 900;
      letter-spacing: 6px;
      line-height: 1;
      color: #ffd45e;
      background: linear-gradient(100deg, #ffd45e 35%, #fffbe0 50%, #ffd45e 65%) 0 0 / 300% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 3px 0 #3a1a08) drop-shadow(0 0 16px rgba(251, 191, 36, 0.45));
      animation: titleLogoShine 4.5s ease-in-out infinite;
      margin-bottom: 2px;
    `;

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.textContent = 'Cozy Maid Estate & Creature Sanctuary';
    subtitle.style.cssText = `
      font-family: 'Silkscreen', 'Courier New', monospace;
      font-size: 11px;
      color: #fbcfe8;
      letter-spacing: 2px;
      text-shadow: 0 2px 0 #1e1329, 0 0 8px rgba(244, 114, 182, 0.5);
      margin-bottom: 12px;
    `;

    // Menu Panel Box
    const panel = document.createElement('div');
    panel.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      width: 100%;
      max-width: 330px;
      padding: 16px 20px 14px;
      background: rgba(22, 16, 36, 0.88);
      border: 3px solid #854d0e;
      border-radius: 10px;
      box-shadow: 0 6px 0 #070510, inset 0 0 0 1px #a16207;
      backdrop-filter: blur(2px);
    `;

    // Play / Resume Button
    const playBtn = this.createMenuButton(
      this.estateTier > 1 ? `Resume Estate (T${this.estateTier})` : 'Play Game',
      '#eab308',
      '#ca8a04',
      () => {
        this.hide();
        this.onPlayCallback();
      }
    );
    playBtn.id = 'title-btn-play';

    // New Game Button
    const newGameBtn = this.createMenuButton('New Game', '#a855f7', '#7e22ce', () => {
      this.promptNewGameConfirmation();
    });

    // Sound Toggle Button
    const soundBtn = this.createMenuButton(
      this.isMuted ? 'Sound: OFF' : 'Sound: ON',
      '#64748b',
      '#475569',
      () => {
        const muted = this.onToggleSoundCallback();
        this.isMuted = muted;
        soundBtn.textContent = muted ? 'Sound: OFF' : 'Sound: ON';
      }
    );

    // Fullscreen Button
    const fsBtn = this.createMenuButton('Fullscreen [F]', '#3b82f6', '#1d4ed8', () => {
      this.onToggleFullscreenCallback();
    });

    // Nyah Ambient Flavor Quote Note
    const note = document.createElement('div');
    note.id = 'title-nyah-note';
    note.textContent = '"don\'t just stand there staring, Master... come inside already!"';
    note.style.cssText = `
      font-family: 'Silkscreen', 'Courier New', monospace;
      font-size: 10px;
      color: #fef08a;
      min-height: 24px;
      margin-top: 6px;
      text-shadow: 0 1px 0 #070510;
      letter-spacing: 0.5px;
    `;

    panel.appendChild(playBtn);
    panel.appendChild(newGameBtn);
    panel.appendChild(soundBtn);
    panel.appendChild(fsBtn);
    panel.appendChild(note);

    card.appendChild(logo);
    card.appendChild(subtitle);
    card.appendChild(panel);
    this.menuElement.appendChild(card);

    // Inject Logo Keyframe animation
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes titleLogoShine {
        0%, 50% { background-position: 100% 0; }
        85%, 100% { background-position: 0 0; }
      }
      .title-btn:hover {
        transform: translateY(-2px);
        filter: brightness(1.15);
      }
      .title-btn:active {
        transform: translateY(1px);
        filter: brightness(0.95);
      }
    `;
    this.menuElement.appendChild(styleEl);

    this.container.appendChild(this.menuElement);
  }

  /**
   * Helper to construct a stylized retro pixel button.
   */
  private createMenuButton(
    text: string,
    topColor: string,
    baseColor: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'title-btn';
    btn.textContent = text;
    btn.style.cssText = `
      width: 100%;
      max-width: 280px;
      font-family: 'Silkscreen', 'Courier New', monospace;
      font-size: 13px;
      font-weight: bold;
      color: #ffffff;
      padding: 9px 12px;
      background: linear-gradient(180deg, ${topColor} 0%, ${baseColor} 100%);
      border: 2px solid #ffffff;
      border-radius: 6px;
      box-shadow: 0 3px 0 #0f0b17;
      cursor: pointer;
      text-shadow: 0 1px 0 #000000;
      letter-spacing: 1px;
      transition: transform 0.08s ease, filter 0.08s ease;
      outline: none;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * Confirmation modal when Master clicks New Game.
   */
  private promptNewGameConfirmation(): void {
    const confirmBox = document.createElement('div');
    confirmBox.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 10;
      background: rgba(10, 7, 18, 0.88);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
      font-family: 'Silkscreen', 'Courier New', monospace;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      max-width: 320px;
      background: #1b122c;
      border: 3px solid #f43f5e;
      border-radius: 10px;
      box-shadow: 0 6px 0 #000000;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    `;

    const title = document.createElement('div');
    title.textContent = 'RESET ESTATE?';
    title.style.cssText = 'color: #fb7185; font-size: 16px; font-weight: bold;';

    const desc = document.createElement('div');
    desc.textContent = 'Miss Nyah will reset all gold and territory to Tier 1 Starter Cottage! Are you sure, Master?';
    desc.style.cssText = 'color: #e2e8f0; font-size: 10px; line-height: 1.5;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 10px; width: 100%; margin-top: 6px;';

    const yesBtn = this.createMenuButton('YES, RESET', '#ef4444', '#b91c1c', () => {
      confirmBox.remove();
      this.onNewGameCallback();
      this.hide();
    });

    const noBtn = this.createMenuButton('CANCEL', '#64748b', '#475569', () => {
      confirmBox.remove();
    });

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(btnRow);
    confirmBox.appendChild(modal);

    this.menuElement.appendChild(confirmBox);
  }

  // =========================================================================
  // Procedural Scene Data Generation
  // =========================================================================
  private initProceduralScene(): void {
    // 1. Stars (fixed deterministic distribution)
    let seed = 1234567;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    this.stars = Array.from({ length: 32 }, () => ({
      x: Math.floor(rnd() * this.W),
      y: Math.floor(rnd() * 68),
      phase: rnd() * 6.28,
    }));

    // 2. Mid Forest Trees (with wind sway parameters)
    this.midTrees = Array.from({ length: 18 }, (_, i) => ({
      x: 10 + i * 17 + Math.floor(rnd() * 10),
      h: 22 + Math.floor(rnd() * 18),
      w: 12 + Math.floor(rnd() * 8),
      phase: rnd() * 6.28,
      flexibility: 0.8 + rnd() * 0.7,
      type: rnd() < 0.5 ? 'pine' : 'oak',
    }));

    // 3. Floating Fireflies / Forest Wisps
    this.fireflies = Array.from({ length: 24 }, () => {
      const bx = rnd() * this.W;
      return {
        x: bx,
        y: 40 + rnd() * 120,
        baseX: bx,
        vY: 4 + rnd() * 9,
        phase: rnd() * 6.28,
        color: rnd() < 0.6 ? '#fef08a' : '#c084fc',
      };
    });

    // 4. Drifting Forest Leaves / Petals
    this.driftingLeaves = Array.from({ length: 12 }, () => ({
      x: rnd() * this.W,
      y: rnd() * this.H,
      vX: 0.6 + rnd() * 0.8,
      vY: 0.3 + rnd() * 0.5,
      rotation: rnd() * 6.28,
      rotSpeed: (rnd() - 0.5) * 3,
      color: rnd() < 0.5 ? '#f472b6' : '#f97316',
    }));

    // Initial wandering creature (Bunbun exploring from the left)
    this.activeCreatures = [
      {
        species: 'bunbun',
        x: 40,
        y: 160,
        targetX: 350,
        dir: 1,
        speed: 18,
        state: 'walk',
        animTimer: 0,
        pauseTimer: 0,
        hopCycle: 0,
      },
    ];
  }

  // =========================================================================
  // Main Render Loop (Capped to ~30 FPS for optimal efficiency)
  // =========================================================================
  public show(): void {
    this.isVisible = true;
    if (this.menuElement) {
      this.menuElement.style.opacity = '1';
      this.menuElement.style.pointerEvents = 'auto';
    }

    if (!this.animationFrameId && typeof requestAnimationFrame !== 'undefined') {
      this.startTime = performance.now();
      this.lastTime = performance.now();
      this.tick(performance.now());
    }
  }

  public hide(): void {
    this.isVisible = false;
    if (this.menuElement) {
      this.menuElement.style.opacity = '0';
      this.menuElement.style.pointerEvents = 'none';
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public updateTier(tier: number): void {
    this.estateTier = tier;
    const playBtn = document.getElementById('title-btn-play');
    if (playBtn) {
      playBtn.textContent = tier > 1 ? `Resume Estate (T${tier})` : 'Play Game';
    }
  }

  private tick = (now: number): void => {
    if (!this.isVisible) return;

    if (now - this.lastTime >= 33) {
      // ~30 frames per second
      const deltaSec = (now - this.lastTime) / 1000;
      const elapsedSec = (now - this.startTime) / 1000;
      this.lastTime = now;

      this.updateSimulation(deltaSec);
      this.renderFrame(elapsedSec);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  // =========================================================================
  // Procedural Update (Creatures, Wind, Leaves, Fireflies)
  // =========================================================================
  private updateSimulation(deltaSec: number): void {
    // 1. Creature Spawner Timer
    this.nextCreatureSpawnTimer -= deltaSec;
    if (this.nextCreatureSpawnTimer <= 0 && this.activeCreatures.length < 2) {
      const fromLeft = Math.random() < 0.5;
      const speciesList: Array<'bunbun' | 'astral_fox' | 'leaflet'> = ['bunbun', 'astral_fox', 'leaflet'];
      const chosen = speciesList[Math.floor(Math.random() * speciesList.length)];

      this.activeCreatures.push({
        species: chosen,
        x: fromLeft ? -25 : this.W + 25,
        y: 159,
        targetX: fromLeft ? this.W + 35 : -35,
        dir: fromLeft ? 1 : -1,
        speed: chosen === 'bunbun' ? 22 : chosen === 'astral_fox' ? 26 : 16,
        state: 'walk',
        animTimer: 0,
        pauseTimer: 0,
        hopCycle: 0,
      });

      this.nextCreatureSpawnTimer = 10.0 + Math.random() * 14.0;
    }

    // 2. Update Active Wandering Creatures
    for (let i = this.activeCreatures.length - 1; i >= 0; i--) {
      const c = this.activeCreatures[i];
      c.animTimer += deltaSec;

      if (c.state === 'walk') {
        c.x += c.dir * c.speed * deltaSec;
        c.hopCycle += deltaSec * (c.species === 'bunbun' ? 4.2 : 3.0);

        // Random chance to pause and look around
        if (Math.random() < 0.008 && c.x > 50 && c.x < this.W - 50) {
          c.state = 'pause';
          c.pauseTimer = 1.2 + Math.random() * 1.5;
        }

        // Despawn once off opposite screen edge
        if ((c.dir === 1 && c.x > this.W + 40) || (c.dir === -1 && c.x < -40)) {
          this.activeCreatures.splice(i, 1);
        }
      } else {
        // Paused state
        c.pauseTimer -= deltaSec;
        if (c.pauseTimer <= 0) {
          c.state = 'walk';
        }
      }
    }

    // 3. Update Drifting Leaves
    for (const leaf of this.driftingLeaves) {
      leaf.x += leaf.vX;
      leaf.y += leaf.vY;
      leaf.rotation += leaf.rotSpeed * deltaSec;
      if (leaf.x > this.W + 10 || leaf.y > this.H + 10) {
        leaf.x = -10 + Math.random() * (this.W * 0.6);
        leaf.y = -10;
      }
    }
  }

  // =========================================================================
  // Canvas Procedural Drawing
  // =========================================================================
  private renderFrame(t: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Wind physics: smooth harmonic oscillation with gusts
    const baseWind = Math.sin(t * 1.6) * 0.7 + Math.sin(t * 2.9 + 0.8) * 0.3;
    const gust = Math.max(0, Math.sin(t * 0.5 - 1.2)) * 1.6;
    const wind = baseWind + gust;

    // 1. Twilight Banded Sky
    this.drawSky(ctx, t);

    // 2. Crescent Moon with Dithered Corona
    this.drawMoon(ctx);

    // 3. Far Silhouette Ridge with Distant Pines
    this.drawFarRidge(ctx);

    // 4. Mid-Ground Forest with Swaying Trees
    this.drawMidForest(ctx, t, wind);

    // 5. Forest Ground Clearing Trail
    this.drawForestGround(ctx);

    // 6. Wandering Woodland Creatures
    this.drawCreatures(ctx, t);

    // 7. Foreground Ancient Trees with Moving Branches and Leaf Clusters
    this.drawForegroundAncientTrees(ctx, t, wind);

    // 8. Ground Mist & Fog Ribbons
    this.drawMist(ctx, t);

    // 9. Floating Fireflies & Drifting Petals
    this.drawAtmosphere(ctx, t, wind);
  }

  private drawSky(ctx: CanvasRenderingContext2D, t: number): void {
    const SKY_COLORS = ['#140d24', '#201335', '#33194a', '#522254', '#7c2d58', '#ad3f58', '#dc6358', '#f89b6f'];
    const maxSkyY = 135;

    for (let y = 0; y < maxSkyY; y += 3) {
      const f = (y / maxSkyY) * (SKY_COLORS.length - 1);
      const i = Math.min(SKY_COLORS.length - 2, Math.floor(f));
      const q = Math.round((f - i) * 4) / 4; // 4-step quantized band
      ctx.fillStyle = this.mixColors(SKY_COLORS[i], SKY_COLORS[i + 1], q);
      ctx.fillRect(0, y, this.W, 3);
    }

    // Stars with gentle sine twinkle
    for (const s of this.stars) {
      const twinkle = 0.4 + 0.6 * Math.sin(t * 3.5 + s.phase);
      ctx.fillStyle = `rgba(255, 245, 220, ${twinkle.toFixed(2)})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }
  }

  private drawMoon(ctx: CanvasRenderingContext2D): void {
    const cx = 246, cy = 38;

    // Dithered celestial glow rings
    for (let dy = -26; dy <= 26; dy++) {
      for (let dx = -26; dx <= 26; dx++) {
        const d = Math.hypot(dx, dy);
        const px = cx + dx;
        const py = cy + dy;

        if (d > 11 && d <= 18 && (px + py) % 2 === 0) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
          ctx.fillRect(px, py, 1, 1);
        } else if (d > 18 && d <= 26 && (px + py) % 4 === 0) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.16)';
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }

    // Crescent moon core
    for (let dy = -11; dy <= 11; dy++) {
      for (let dx = -11; dx <= 11; dx++) {
        const d1 = Math.hypot(dx, dy);
        const d2 = Math.hypot(dx + 4, dy - 2); // cutout circle

        if (d1 <= 11 && d2 > 9) {
          ctx.fillStyle = d1 < 9 ? '#fffbe8' : '#fef08a';
          ctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }
  }

  private drawFarRidge(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#3f2654';
    for (let x = 0; x < this.W; x++) {
      const y = Math.round(98 + 9 * Math.sin(x * 0.018 + 0.4) + 4 * Math.sin(x * 0.042));
      ctx.fillRect(x, y, 1, this.H - y);

      // Distant tiny pines along the ridge
      if (x % 9 === 0) {
        ctx.fillStyle = '#553470';
        ctx.fillRect(x, y - 4, 1, 4);
        ctx.fillRect(x - 1, y - 2, 3, 2);
        ctx.fillStyle = '#3f2654';
      }
    }
  }

  private drawMidForest(ctx: CanvasRenderingContext2D, t: number, wind: number): void {
    // 1. Mid ground ridge
    ctx.fillStyle = '#26163b';
    const midRidgeY: number[] = [];
    for (let x = 0; x < this.W; x++) {
      const y = Math.round(130 + 7 * Math.sin(x * 0.022 + 1.2) + 3 * Math.sin(x * 0.06));
      midRidgeY[x] = y;
      ctx.fillRect(x, y, 1, this.H - y);
      ctx.fillStyle = '#382154'; // rim
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = '#26163b';
    }

    // 2. Swaying mid-ground trees
    for (const tree of this.midTrees) {
      const baseY = midRidgeY[tree.x] ?? 132;
      const trunkH = tree.h;

      // Draw bending trunk
      for (let dy = 0; dy < trunkH; dy++) {
        const progress = dy / trunkH;
        const sway = wind * Math.pow(progress, 1.4) * tree.flexibility * 2.2;
        ctx.fillStyle = '#170e26';
        ctx.fillRect(Math.round(tree.x + sway), baseY - dy, 2, 1);
      }

      // Draw wind-displaced foliage layers
      const topSway = wind * tree.flexibility * 2.2;
      const foliageBaseY = baseY - trunkH;

      if (tree.type === 'pine') {
        // 3 stacked pine tiers
        for (let tier = 0; tier < 3; tier++) {
          const tierY = foliageBaseY + tier * 5;
          const tierW = Math.max(5, tree.w - tier * 3);
          const tierSway = topSway * (1 - tier * 0.18) + Math.sin(t * 2.5 + tree.phase + tier) * 1.2;

          ctx.fillStyle = '#321d4c';
          ctx.fillRect(Math.round(tree.x + tierSway - (tierW >> 1)), tierY - 6, tierW, 6);
          // Highlight edge on the left
          ctx.fillStyle = '#452968';
          ctx.fillRect(Math.round(tree.x + tierSway - (tierW >> 1)), tierY - 6, 1, 6);
        }
      } else {
        // Round oak canopy
        const oakSway = topSway + Math.sin(t * 2.2 + tree.phase) * 1.4;
        const r = Math.round(tree.w / 2);
        this.fillPixelCircle(ctx, Math.round(tree.x + oakSway), foliageBaseY - 2, r, '#321d4c');
        this.fillPixelCircle(ctx, Math.round(tree.x + oakSway - 1), foliageBaseY - 4, r - 2, '#452968');
      }
    }
  }

  private drawForestGround(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#140c22';
    for (let x = 0; x < this.W; x++) {
      const y = Math.round(156 + 4 * Math.sin(x * 0.026 + 1.8));
      ctx.fillRect(x, y, 1, this.H - y);

      // Mossy grass rim
      ctx.fillStyle = '#221436';
      ctx.fillRect(x, y, 1, 2);
      if ((x * 7) % 11 === 0) {
        ctx.fillStyle = '#4ade80'; // tiny glowing forest moss spec
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = '#140c22';
    }
  }

  private drawForegroundAncientTrees(ctx: CanvasRenderingContext2D, t: number, wind: number): void {
    // Left Giant Oak: base at (28, 168), height 92
    this.drawAncientTree(ctx, 28, 168, 92, 1, t, wind, '#11091c', '#201133', '#2d1847');

    // Right Giant Oak: base at (294, 168), height 98
    this.drawAncientTree(ctx, 294, 168, 98, -1, t, wind, '#11091c', '#201133', '#2d1847');
  }

  private drawAncientTree(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    height: number,
    archDir: 1 | -1,
    t: number,
    wind: number,
    trunkColor: string,
    foliageDark: string,
    foliageLight: string
  ): void {
    // 1. Spreading gnarly roots at base
    ctx.fillStyle = trunkColor;
    ctx.fillRect(bx - 8, by - 4, 16, 5);
    ctx.fillRect(bx - 12, by - 2, 6, 3);
    ctx.fillRect(bx + 6, by - 2, 6, 3);

    // 2. Trunk bending with wind
    const topX = bx + archDir * 32 + wind * 4.5;
    const topY = by - height;

    for (let dy = 0; dy < height; dy++) {
      const progress = dy / height;
      const sway = wind * Math.pow(progress, 1.3) * 4.2;
      const arch = archDir * Math.pow(progress, 1.6) * 30;
      const x = Math.round(bx + arch + sway);
      const w = Math.max(3, Math.round(9 * (1 - progress * 0.65)));

      ctx.fillRect(x - (w >> 1), by - dy, w, 1);
    }

    // 3. Spreading Boughs & Swaying Foliage Clusters
    const branchDefs = [
      { relX: archDir * 24, relY: -height * 0.72, r: 16, phase: 0.2 },
      { relX: archDir * 42, relY: -height * 0.88, r: 18, phase: 0.8 },
      { relX: archDir * 12, relY: -height * 0.96, r: 15, phase: 1.4 },
      { relX: archDir * 54, relY: -height * 0.76, r: 14, phase: 2.1 },
    ];

    for (let i = 0; i < branchDefs.length; i++) {
      const b = branchDefs[i];
      const branchWind = wind * 4.5 + Math.sin(t * 3.2 + b.phase) * 2.2;
      const cx = Math.round(bx + b.relX + branchWind);
      const cy = Math.round(by + b.relY + Math.cos(t * 2.4 + b.phase) * 1.0);

      // Foliage cluster
      this.fillPixelCircle(ctx, cx, cy, b.r, foliageDark);
      this.fillPixelCircle(ctx, cx - archDir * 2, cy - 2, b.r - 3, foliageLight);

      // Hanging moss / leaf tendrils swaying in the wind
      const mossDrop = 10 + (i % 3) * 4;
      for (let m = 0; m < mossDrop; m++) {
        const mossSway = Math.sin(t * 3.8 + b.phase + m * 0.4) * 2.0 + wind * 1.5;
        ctx.fillStyle = foliageDark;
        ctx.fillRect(Math.round(cx + (i % 2 === 0 ? -4 : 4) + mossSway), cy + b.r - 2 + m, 2, 1);
      }
    }
  }

  private drawCreatures(ctx: CanvasRenderingContext2D, t: number): void {
    for (const c of this.activeCreatures) {
      if (c.species === 'bunbun') {
        this.drawBunbun(ctx, c);
      } else if (c.species === 'astral_fox') {
        this.drawAstralFox(ctx, c);
      } else {
        this.drawLeaflet(ctx, c, t);
      }
    }
  }

  /**
   * Bunbun: cozy hopping white bunny with floppy ears and maid ribbon.
   */
  private drawBunbun(ctx: CanvasRenderingContext2D, c: WanderingCreature): void {
    const isHop = c.state === 'walk';
    const hopProgress = isHop ? (c.hopCycle % Math.PI) : 0;
    const yBounce = isHop ? Math.abs(Math.sin(hopProgress)) * 6.5 : 0;
    const x = Math.round(c.x);
    const y = Math.round(c.y - yBounce);
    const d = c.dir;

    // Soft drop shadow
    ctx.fillStyle = 'rgba(10, 7, 18, 0.45)';
    ctx.fillRect(x - 5, Math.round(c.y + 1), 10, 2);

    // Body (warm porcelain white)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 4, y - 6, 8, 6);
    ctx.fillRect(x - 5, y - 5, 10, 4);

    // Fluffy tail
    ctx.fillRect(x - d * 5, y - 5, 2, 2);

    // Paws
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(x - 3, y, 2, 1);
    ctx.fillRect(x + 1, y, 2, 1);

    // Ears (bounce back during hop leap)
    const earTilt = isHop && yBounce > 2 ? -d * 2 : 0;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 2 + earTilt, y - 11, 2, 5);
    ctx.fillRect(x + 1 + earTilt, y - 10, 2, 4);
    // Pink inner ear
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(x - 1 + earTilt, y - 10, 1, 4);

    // Face: bead eye & pink nose
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + d * 2, y - 4, 1, 1);
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(x + d * 4, y - 3, 1, 1);

    // Maid black ribbon on head
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 1, y - 7, 3, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y - 7, 1, 1);
  }

  /**
   * Astral Fox: sleek violet creature with starry tail trotting through the woods.
   */
  private drawAstralFox(ctx: CanvasRenderingContext2D, c: WanderingCreature): void {
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    const d = c.dir;
    const step = c.state === 'walk' ? Math.sin(c.hopCycle * 2) : 0;

    // Drop shadow
    ctx.fillStyle = 'rgba(10, 7, 18, 0.45)';
    ctx.fillRect(x - 7, y + 1, 14, 2);

    // Body
    ctx.fillStyle = '#818cf8';
    ctx.fillRect(x - 6, y - 7, 12, 6);
    ctx.fillRect(x - 5, y - 8, 10, 8);

    // Lavender chest & snout
    ctx.fillStyle = '#c7d2fe';
    ctx.fillRect(x + d * 3, y - 6, 3, 4);
    ctx.fillRect(x + d * 6, y - 5, 2, 2); // nose tip

    // Sharp fox ears
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(x + d * 1, y - 11, 2, 4);
    ctx.fillRect(x + d * 4, y - 11, 2, 4);
    ctx.fillStyle = '#fbcfe8';
    ctx.fillRect(x + d * 2, y - 10, 1, 2);

    // Eye
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + d * 4, y - 6, 1, 1);

    // Bushy cosmic tail curving up with star sparkles
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(x - d * 7, y - 7, 3, 3);
    ctx.fillRect(x - d * 9, y - 10, 3, 4);
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(x - d * 10, y - 12, 2, 3);
    ctx.fillStyle = '#fef08a'; // star tip
    ctx.fillRect(x - d * 10, y - 13, 1, 1);

    // Legs with trot cycle
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(x - 4, y - 1, 2, Math.round(2 + step));
    ctx.fillRect(x + 3, y - 1, 2, Math.round(2 - step));
  }

  /**
   * Leaflet: little green plant creature with an animated head-leaf swaying in the breeze.
   */
  private drawLeaflet(ctx: CanvasRenderingContext2D, c: WanderingCreature, t: number): void {
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    const d = c.dir;
    const waddle = c.state === 'walk' ? Math.sin(c.hopCycle * 2.5) * 1.2 : 0;

    // Drop shadow
    ctx.fillStyle = 'rgba(10, 7, 18, 0.45)';
    ctx.fillRect(x - 4, y + 1, 8, 2);

    // Round body
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(x - 4, y - 6 + Math.round(waddle), 8, 6);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x - 3, y - 7 + Math.round(waddle), 6, 7);

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + d * 1, y - 5 + Math.round(waddle), 1, 2);
    ctx.fillRect(x + d * 3, y - 5 + Math.round(waddle), 1, 2);

    // Leaf sprout swaying with wind
    const leafSway = Math.sin(t * 4.5) * 2.2 + (d * 1.5);
    ctx.fillStyle = '#15803d'; // stem
    ctx.fillRect(x, y - 8 + Math.round(waddle), 1, 2);
    ctx.fillStyle = '#86efac'; // leaf
    ctx.fillRect(Math.round(x + leafSway), y - 11 + Math.round(waddle), 3, 2);
    ctx.fillRect(Math.round(x + leafSway + 1), y - 12 + Math.round(waddle), 2, 1);
  }

  private drawMist(ctx: CanvasRenderingContext2D, t: number): void {
    for (let k = 0; k < 3; k++) {
      const y0 = 152 + k * 8;
      const alpha = 0.05 + k * 0.025;
      ctx.fillStyle = `rgba(232, 210, 255, ${alpha.toFixed(3)})`;

      for (let x = 0; x < this.W; x += 4) {
        const wob = Math.sin(x * 0.03 + t * 0.8 + k * 2) * 2.5;
        ctx.fillRect(x, Math.round(y0 + wob), 4, 4);
      }
    }
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D, t: number, wind: number): void {
    // 1. Fireflies / Wisps
    for (const f of this.fireflies) {
      const fy = ((f.y - t * f.vY) % (this.H + 10));
      const y = fy < 0 ? fy + this.H + 10 : fy;
      const x = f.baseX + Math.sin(t * 1.4 + f.phase) * 10;
      const pulse = 0.3 + 0.7 * Math.sin(t * 4.0 + f.phase);

      if (pulse > 0.15) {
        ctx.fillStyle = f.color;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }

    // 2. Wind-drifted leaves / petals
    for (const leaf of this.driftingLeaves) {
      ctx.save();
      ctx.fillStyle = leaf.color;
      ctx.fillRect(Math.round(leaf.x), Math.round(leaf.y), 2, 1);
      ctx.restore();
    }
  }

  // =========================================================================
  // Math & Color Utilities
  // =========================================================================
  private fillPixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
    ctx.fillStyle = color;
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      const maxDx = Math.floor(Math.sqrt(Math.max(0, r2 - dy * dy)));
      ctx.fillRect(cx - maxDx, cy + dy, maxDx * 2 + 1, 1);
    }
  }

  private mixColors(hexA: string, hexB: string, t: number): string {
    const parse = (h: string) => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const a = parse(hexA);
    const b = parse(hexB);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }
}
