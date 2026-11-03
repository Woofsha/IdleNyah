// src/render/bespokeAssets.ts
import { Texture, TextureSource, CanvasSource, Rectangle } from 'pixi.js';

/**
 * Creates a crisp pixel-art texture from a 2D canvas drawing routine.
 * Gracefully provides a headless TextureSource stub if running under Node.js / Vitest.
 */
export function createPixelCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): Texture {
  if (typeof document === 'undefined') {
    const source = new TextureSource({ width, height });
    return new Texture({ source, frame: new Rectangle(0, 0, width, height) });
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    try {
      draw(ctx);
    } catch {
      // Fallback gracefully in headless test runners with incomplete mock contexts
    }
  }

  let source: TextureSource;
  try {
    source = new CanvasSource({
      resource: canvas,
      width,
      height,
      scaleMode: 'nearest',
    });
  } catch {
    source = new TextureSource({ width, height, scaleMode: 'nearest' });
  }

  return new Texture({ source, frame: new Rectangle(0, 0, width, height) });
}

export interface BespokeEstateAssets {
  cottage: Texture;
  villa: Texture;
  manor: Texture;
  library: Texture;
  observatory: Texture;
  lawn: Texture;
  lawnFlowers: Texture;
  path: Texture;
  porchWood: Texture;
  hedge: Texture;
  water: Texture;
  tree: Texture;
  bush: Texture;
  wickerBasket: Texture;
}

let cachedAssets: BespokeEstateAssets | null = null;

/**
 * Helper to rasterize integer pixel circles for crisp pixel art without subpixel blur.
 */
function fillPixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  const r2 = r * r;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r2) {
        ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
      }
    }
  }
}

/**
 * Generates all original, authentic pixel-art assets for the estate.
 */
export function getBespokeEstateAssets(): BespokeEstateAssets {
  if (cachedAssets) return cachedAssets;

  // 1. Desaturated Storybook Meadow Lawn (32x32)
  const lawn = createPixelCanvasTexture(32, 32, (ctx) => {
    // Rich desaturated warm sage/olive base (#35452e)
    ctx.fillStyle = '#35452e';
    ctx.fillRect(0, 0, 32, 32);

    // Natural organic dappled earth & meadow patches (#3e5237, #455a3d)
    ctx.fillStyle = '#3e5237';
    const patchesA: [number, number, number, number][] = [
      [2, 2, 8, 6], [14, 1, 9, 5], [25, 3, 6, 7],
      [1, 14, 7, 7], [11, 10, 10, 8], [23, 13, 8, 6],
      [4, 23, 8, 6], [15, 20, 11, 7], [26, 22, 6, 7],
      [0, 7, 5, 5], [27, 0, 5, 4], [11, 27, 8, 5]
    ];
    for (const [px, py, pw, ph] of patchesA) {
      ctx.fillRect(px, py, pw, ph);
    }

    ctx.fillStyle = '#455a3d';
    const patchesB: [number, number, number, number][] = [
      [4, 4, 4, 3], [16, 2, 5, 3], [13, 12, 6, 4],
      [6, 25, 4, 3], [18, 22, 5, 4], [25, 15, 4, 3]
    ];
    for (const [px, py, pw, ph] of patchesB) {
      ctx.fillRect(px, py, pw, ph);
    }

    // Grass blade tufts with three-pass diorama lighting:
    // (1) Root depth hue-shifted cool shadow (#1c2722)
    // (2) Textured body (#4c6442)
    // (3) Lit upper-right golden-rim tips (#7a9456, #96b06b)
    const tufts = [
      { x: 5, y: 7 },
      { x: 19, y: 5 },
      { x: 12, y: 15 },
      { x: 27, y: 11 },
      { x: 4, y: 22 },
      { x: 22, y: 20 },
      { x: 14, y: 26 },
      { x: 29, y: 27 },
    ];
    for (const t of tufts) {
      // Cool root shadow
      ctx.fillStyle = '#1c2722';
      ctx.fillRect(t.x, t.y + 3, 3, 1);

      // Textured body
      ctx.fillStyle = '#4c6442';
      ctx.fillRect(t.x, t.y + 1, 1, 2);
      ctx.fillRect(t.x + 1, t.y, 1, 3);
      ctx.fillRect(t.x + 2, t.y + 1, 1, 2);

      // Warm upper-right sunlit tip
      ctx.fillStyle = '#7a9456';
      ctx.fillRect(t.x, t.y, 1, 1);
      ctx.fillStyle = '#96b06b';
      ctx.fillRect(t.x + 1, t.y - 1, 1, 1);
      ctx.fillRect(t.x + 2, t.y, 1, 1);
    }

    // Dither specks & subtle earth pebbles
    ctx.fillStyle = '#2d3a27';
    const darkSpecks: [number, number][] = [
      [8, 2], [24, 8], [3, 13], [18, 18], [9, 20], [25, 24], [1, 29], [30, 16], [16, 9]
    ];
    for (const [sx, sy] of darkSpecks) {
      ctx.fillRect(sx, sy, 1, 1);
    }

    ctx.fillStyle = '#68824c';
    const lightSpecks: [number, number][] = [
      [9, 3], [25, 9], [4, 14], [19, 19], [10, 21], [26, 25], [2, 30], [31, 17], [17, 10]
    ];
    for (const [lx, ly] of lightSpecks) {
      ctx.fillRect(lx, ly, 1, 1);
    }
  });

  // 2. Storybook Meadow with Subtle Wildflowers (Chamomile & Heather) (32x32)
  const lawnFlowers = createPixelCanvasTexture(32, 32, (ctx) => {
    // Exact matching desaturated meadow base
    ctx.fillStyle = '#35452e';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#3e5237';
    const patchesA: [number, number, number, number][] = [
      [2, 2, 8, 6], [14, 1, 9, 5], [25, 3, 6, 7],
      [1, 14, 7, 7], [11, 10, 10, 8], [23, 13, 8, 6],
      [4, 23, 8, 6], [15, 20, 11, 7], [26, 22, 6, 7],
      [0, 7, 5, 5], [27, 0, 5, 4], [11, 27, 8, 5]
    ];
    for (const [px, py, pw, ph] of patchesA) {
      ctx.fillRect(px, py, pw, ph);
    }

    // Grass tufts
    const tufts = [
      { x: 5, y: 7 }, { x: 19, y: 5 }, { x: 12, y: 15 },
      { x: 27, y: 11 }, { x: 4, y: 22 }, { x: 22, y: 20 },
    ];
    for (const t of tufts) {
      ctx.fillStyle = '#1c2722';
      ctx.fillRect(t.x, t.y + 3, 3, 1);
      ctx.fillStyle = '#4c6442';
      ctx.fillRect(t.x, t.y + 1, 1, 2);
      ctx.fillRect(t.x + 1, t.y, 1, 3);
      ctx.fillRect(t.x + 2, t.y + 1, 1, 2);
      ctx.fillStyle = '#96b06b';
      ctx.fillRect(t.x + 1, t.y - 1, 1, 1);
    }

    // Chamomile daisies (warm linen petals, amber core)
    const chamomiles = [{ x: 7, y: 8 }, { x: 21, y: 14 }, { x: 11, y: 24 }];
    for (const ch of chamomiles) {
      // Sepal shadow
      ctx.fillStyle = '#1c2722';
      ctx.fillRect(ch.x - 1, ch.y, 5, 2);
      // Soft linen-cream petals
      ctx.fillStyle = '#ebe7db';
      ctx.fillRect(ch.x, ch.y - 1, 3, 1);
      ctx.fillRect(ch.x - 1, ch.y, 5, 1);
      ctx.fillRect(ch.x, ch.y + 1, 3, 1);
      // Warm amber center
      ctx.fillStyle = '#d99726';
      ctx.fillRect(ch.x + 1, ch.y, 1, 1);
      ctx.fillStyle = '#925f12';
      ctx.fillRect(ch.x + 1, ch.y + 1, 1, 1);
    }

    // Muted wild heather buds (soft dusty lavender-rose)
    const heatherBuds = [{ x: 18, y: 6 }, { x: 4, y: 18 }, { x: 26, y: 23 }];
    for (const hb of heatherBuds) {
      ctx.fillStyle = '#1c2722';
      ctx.fillRect(hb.x, hb.y + 2, 2, 1);
      ctx.fillStyle = '#836582';
      ctx.fillRect(hb.x, hb.y + 1, 2, 2);
      ctx.fillStyle = '#b08ea0';
      ctx.fillRect(hb.x, hb.y, 2, 2);
      ctx.fillStyle = '#d8bdca';
      ctx.fillRect(hb.x, hb.y, 1, 1);
    }

    // Tiny woodland buttercups (amber-gold)
    const buttercups = [{ x: 14, y: 12 }, { x: 28, y: 7 }];
    for (const b of buttercups) {
      ctx.fillStyle = '#c4962c';
      ctx.fillRect(b.x, b.y, 2, 2);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(b.x, b.y, 1, 1);
    }
  });

  // 3. Natural Warm Flagstone Pavers with Rounded Edges & Moss (32x32)
  const path = createPixelCanvasTexture(32, 32, (ctx) => {
    // Cool violet-slate mortar base (#30293d)
    ctx.fillStyle = '#30293d';
    ctx.fillRect(0, 0, 32, 32);

    // Deep crevice shadows
    ctx.fillStyle = '#201b2a';
    ctx.fillRect(0, 15, 32, 2);
    ctx.fillRect(15, 0, 2, 32);

    // Paver blocks with warm sunlit rim on upper-right
    const pavers: {
      x: number;
      y: number;
      w: number;
      h: number;
      base: string;
      hi: string;
      sh: string;
    }[] = [
      { x: 1, y: 1, w: 13, h: 13, base: '#70675f', hi: '#c0b4a6', sh: '#483f38' },
      { x: 17, y: 1, w: 14, h: 14, base: '#857970', hi: '#d1c5b8', sh: '#574c44' },
      { x: 1, y: 17, w: 14, h: 14, base: '#998d83', hi: '#e0d4c8', sh: '#63564e' },
      { x: 18, y: 18, w: 13, h: 13, base: '#7c7167', hi: '#cbbdb0', sh: '#4f443c' },
    ];

    for (const p of pavers) {
      // Rounded stone body
      ctx.fillStyle = p.base;
      ctx.fillRect(p.x + 1, p.y, p.w - 2, p.h);
      ctx.fillRect(p.x, p.y + 1, p.w, p.h - 2);

      // Top and left bevel highlight
      ctx.fillStyle = p.hi;
      ctx.fillRect(p.x + 1, p.y + 1, p.w - 3, 1);
      ctx.fillRect(p.x + 1, p.y + 1, 1, p.h - 3);

      // Bottom and right drop shadow into mortar
      ctx.fillStyle = p.sh;
      ctx.fillRect(p.x + 2, p.y + p.h - 1, p.w - 3, 1);
      ctx.fillRect(p.x + p.w - 1, p.y + 2, 1, p.h - 3);

      // Subtle stone grain
      ctx.fillStyle = p.hi;
      ctx.fillRect(p.x + 4, p.y + 4, 1, 1);
      ctx.fillRect(p.x + p.w - 5, p.y + 5, 1, 1);
      ctx.fillStyle = p.sh;
      ctx.fillRect(p.x + 6, p.y + p.h - 5, 1, 1);
    }

    // Natural moss accents growing in mortar crevices
    const mossAccents: [number, number, string][] = [
      [15, 6, '#274523'], [15, 7, '#3d6335'], [16, 7, '#648e56'],
      [14, 15, '#274523'], [15, 15, '#3d6335'], [15, 16, '#648e56'],
      [8, 15, '#3d6335'], [24, 16, '#274523'], [16, 24, '#3d6335'],
      [16, 25, '#648e56'], [7, 0, '#274523'], [24, 31, '#3d6335']
    ];
    for (const [mx, my, mc] of mossAccents) {
      ctx.fillStyle = mc;
      ctx.fillRect(mx, my, 1, 1);
    }
  });

  // 4. Deep Warm Cedar Porch Planks with Wood Grain & Iron Nails (32x32)
  const porchWood = createPixelCanvasTexture(32, 32, (ctx) => {
    // Dark groove background
    ctx.fillStyle = '#211208';
    ctx.fillRect(0, 0, 32, 32);

    const plankTones = ['#733b1c', '#814321', '#793e1e', '#844523'];

    for (let r = 0; r < 4; r++) {
      const y = r * 8;
      // Plank body (7px tall wood, 1px groove below)
      ctx.fillStyle = plankTones[r];
      ctx.fillRect(0, y, 32, 7);

      // Top bevel highlight (sunlit golden plank edge)
      ctx.fillStyle = '#b66b3c';
      ctx.fillRect(0, y, 32, 1);

      // Bottom bevel shadow
      ctx.fillStyle = '#492109';
      ctx.fillRect(0, y + 6, 32, 1);

      // Wood-grain horizontal lines
      ctx.fillStyle = '#5c2c12';
      ctx.fillRect(2, y + 2, 12, 1);
      ctx.fillRect(18, y + 4, 10, 1);
      ctx.fillRect(8, y + 5, 8, 1);

      ctx.fillStyle = '#945028';
      ctx.fillRect(15, y + 2, 14, 1);
      ctx.fillRect(4, y + 3, 10, 1);

      // Natural wood grain knot on alternate planks
      if (r === 1) {
        ctx.fillStyle = '#492109';
        ctx.fillRect(11, y + 3, 3, 2);
        ctx.fillStyle = '#311406';
        ctx.fillRect(12, y + 3, 1, 1);
      } else if (r === 2) {
        ctx.fillStyle = '#492109';
        ctx.fillRect(21, y + 2, 3, 2);
        ctx.fillStyle = '#311406';
        ctx.fillRect(22, y + 3, 1, 1);
      }

      // Hand-forged iron nails
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(3, y + 3, 2, 2);
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(3, y + 3, 1, 1);

      ctx.fillStyle = '#1c1917';
      ctx.fillRect(28, y + 3, 2, 2);
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(28, y + 3, 1, 1);
    }
  });

  // 5. Chunky Storybook Boxwood Hedge (Fully Opaque with Baked Lawn Base) (32x32)
  const hedge = createPixelCanvasTexture(32, 32, (ctx) => {
    // 1. OPAQUE LAWN BASE - Guarantees zero black cutouts or transparent voids!
    ctx.fillStyle = '#35452e';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#3e5237';
    ctx.fillRect(2, 2, 12, 8);
    ctx.fillRect(16, 20, 14, 10);
    ctx.fillStyle = '#455a3d';
    ctx.fillRect(4, 3, 6, 4);

    // 2. Soft Cool Ambient Cast Shadow (shifted to bottom-left toward violet/slate)
    ctx.fillStyle = '#191b29';
    ctx.fillRect(3, 26, 26, 4);
    ctx.fillRect(5, 29, 22, 2);

    // 3. Chunky Asymmetric Boxwood Foliage Silhouette (No perfect circles!)
    // Deep under-canopy cool shadow (#172322 teal & #1e1b2f violet)
    ctx.fillStyle = '#1a2228';
    ctx.fillRect(4, 10, 24, 16);
    ctx.fillRect(2, 13, 28, 12);
    ctx.fillRect(6, 7, 20, 18);

    // Core textured olive foliage (#2f452a, #3c5634)
    ctx.fillStyle = '#2f452a';
    ctx.fillRect(5, 11, 22, 14);
    ctx.fillRect(3, 14, 26, 10);
    ctx.fillRect(7, 8, 18, 16);

    ctx.fillStyle = '#3c5634';
    ctx.fillRect(6, 9, 19, 13);
    ctx.fillRect(4, 13, 23, 9);

    // Upper-right foliage mass & textured clusters (#4f7043, #618751)
    ctx.fillStyle = '#4f7043';
    ctx.fillRect(10, 8, 14, 10);
    ctx.fillRect(12, 6, 10, 8);
    ctx.fillRect(7, 12, 16, 8);

    ctx.fillStyle = '#618751';
    ctx.fillRect(12, 7, 10, 7);
    ctx.fillRect(15, 5, 8, 5);

    // 4. Lit Edge / Rim Pass: Warm Golden Rim on Upper-Right Surfaces (#8ba852, #b5d168, #d8ea8c)
    ctx.fillStyle = '#8ba852';
    const rimMid: [number, number][] = [
      [13, 6], [14, 6], [15, 5], [16, 5], [17, 5], [18, 5], [19, 5], [20, 6], [21, 6], [22, 7],
      [23, 8], [24, 9], [25, 10], [25, 11], [26, 12], [26, 13], [24, 14], [22, 13]
    ];
    for (const [rx, ry] of rimMid) {
      ctx.fillRect(rx, ry, 1, 1);
    }

    ctx.fillStyle = '#b5d168';
    const rimHi: [number, number][] = [
      [14, 5], [15, 4], [16, 4], [17, 4], [18, 4], [19, 4], [20, 5], [21, 5],
      [22, 6], [23, 7], [24, 8], [25, 9]
    ];
    for (const [hx, hy] of rimHi) {
      ctx.fillRect(hx, hy, 1, 1);
    }

    ctx.fillStyle = '#d8ea8c';
    const rimPeak: [number, number][] = [
      [16, 3], [17, 3], [18, 3], [19, 3], [22, 5], [23, 6]
    ];
    for (const [px, py] of rimPeak) {
      ctx.fillRect(px, py, 1, 1);
    }

    // Leaf dither & clusters
    ctx.fillStyle = '#45633b';
    ctx.fillRect(8, 16, 2, 2);
    ctx.fillRect(13, 17, 2, 2);
    ctx.fillRect(18, 16, 2, 2);

    // Subtle creamy chamomile buds
    ctx.fillStyle = '#f3eedf';
    ctx.fillRect(12, 11, 2, 2);
    ctx.fillRect(20, 10, 2, 2);
    ctx.fillStyle = '#d99726';
    ctx.fillRect(12, 11, 1, 1);
    ctx.fillRect(20, 10, 1, 1);

    // Muted wild rose buds
    ctx.fillStyle = '#a87488';
    ctx.fillRect(7, 14, 2, 2);
    ctx.fillStyle = '#d4a2b5';
    ctx.fillRect(7, 14, 1, 1);
  });

  // 6. Sparkling Water Tile (32x32)
  const water = createPixelCanvasTexture(32, 32, (ctx) => {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 8, 32, 4);
    ctx.fillRect(0, 22, 32, 4);

    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(6, 6, 8, 2);
    ctx.fillRect(20, 20, 10, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 6, 2, 1);
    ctx.fillRect(24, 20, 2, 1);
  });

  // 7. Painterly Storybook Oak Tree (Asymmetrical Chunky Silhouette & Warm Rim) (48x64)
  const tree = createPixelCanvasTexture(48, 64, (ctx) => {
    // 1. Soft Occlusion / Cast Ground Shadow (shifted toward lower-left in diorama perspective)
    ctx.fillStyle = '#141222';
    ctx.fillRect(8, 58, 30, 4);
    ctx.fillRect(12, 61, 22, 2);

    // 2. Gnarled Trunk & Gripping Roots
    // Roots spreading outward with cool left shadow and warm right highlights
    ctx.fillStyle = '#1c1524'; // cool shadow root left
    ctx.fillRect(13, 58, 6, 3);
    ctx.fillRect(11, 60, 5, 2);

    ctx.fillStyle = '#3a2215'; // core root
    ctx.fillRect(17, 56, 14, 5);

    ctx.fillStyle = '#6b3d1f'; // warm sunlit root right
    ctx.fillRect(27, 58, 8, 3);
    ctx.fillRect(30, 60, 6, 2);
    ctx.fillStyle = '#a66232';
    ctx.fillRect(31, 59, 4, 1);

    // Trunk core (curving slightly, organic bark grain)
    // Left shadow edge (hue-shifted cool violet #201726)
    ctx.fillStyle = '#201726';
    ctx.fillRect(19, 36, 3, 22);
    ctx.fillRect(18, 44, 2, 14);

    // Center dark bark core (#3f2618)
    ctx.fillStyle = '#3f2618';
    ctx.fillRect(21, 35, 6, 22);

    // Bark furrows
    ctx.fillStyle = '#24140b';
    ctx.fillRect(23, 38, 1, 16);
    ctx.fillRect(25, 42, 1, 12);

    // Right sunlit bark ridges (warm amber key light #8f5024, #bf7439)
    ctx.fillStyle = '#8f5024';
    ctx.fillRect(26, 36, 3, 21);
    ctx.fillRect(28, 40, 2, 16);
    ctx.fillStyle = '#bf7439';
    ctx.fillRect(28, 37, 1, 14);
    ctx.fillRect(27, 48, 1, 6);

    // Boughs branching organically into foliage
    ctx.fillStyle = '#3f2618';
    ctx.fillRect(15, 33, 7, 5);
    ctx.fillRect(26, 32, 9, 6);
    ctx.fillStyle = '#201726';
    ctx.fillRect(14, 34, 4, 3);
    ctx.fillStyle = '#8f5024';
    ctx.fillRect(31, 33, 4, 3);

    // 3. Chunky Asymmetric Canopy Silhouettes
    // Oversized upper-right mass, lower drooping left branch, organic perimeter tufts

    // Pass 1: Deep hue-shifted cool shadow (lower-left & under-canopy: #181d29 violet-night & #182622 forest-slate)
    ctx.fillStyle = '#181d29';
    ctx.fillRect(10, 16, 26, 20);
    ctx.fillRect(6, 22, 18, 14);
    ctx.fillRect(14, 10, 24, 26);
    ctx.fillRect(4, 26, 14, 8);

    ctx.fillStyle = '#182622';
    ctx.fillRect(8, 20, 28, 16);
    ctx.fillRect(12, 14, 28, 20);
    ctx.fillRect(16, 8, 22, 18);

    // Pass 2: Textured Desaturated Olive Body (#33492c, #405b36, #4e6e42)
    ctx.fillStyle = '#33492c';
    ctx.fillRect(10, 16, 28, 18);
    ctx.fillRect(14, 10, 26, 22);
    ctx.fillRect(8, 22, 22, 12);
    ctx.fillRect(18, 6, 22, 22);

    ctx.fillStyle = '#405b36';
    ctx.fillRect(14, 12, 24, 18);
    ctx.fillRect(18, 8, 22, 18);
    ctx.fillRect(22, 5, 18, 16);
    ctx.fillRect(12, 22, 18, 8);

    ctx.fillStyle = '#4e6e42';
    ctx.fillRect(18, 10, 22, 15);
    ctx.fillRect(24, 6, 17, 14);
    ctx.fillRect(22, 16, 18, 10);

    // Pass 3: Upper-Right Foliage Clumps & Leaf Tufts (#618951, #76a361)
    ctx.fillStyle = '#618951';
    ctx.fillRect(24, 8, 16, 12);
    ctx.fillRect(28, 5, 13, 11);
    ctx.fillRect(20, 14, 18, 10);
    ctx.fillRect(32, 14, 10, 8);

    ctx.fillStyle = '#76a361';
    ctx.fillRect(27, 6, 13, 9);
    ctx.fillRect(31, 4, 10, 8);
    ctx.fillRect(34, 12, 8, 7);

    // Pass 4: Lit Edge / Warm Rim Pass (Upper-Right Key Light #9cb958, #c2dd6c, #e2f28e)
    ctx.fillStyle = '#9cb958';
    const treeRimMid: [number, number][] = [
      [28, 4], [29, 4], [30, 3], [31, 3], [32, 2], [33, 2], [34, 2], [35, 2], [36, 3], [37, 3],
      [38, 4], [39, 4], [40, 5], [41, 6], [41, 7], [42, 8], [42, 9], [42, 10], [41, 11], [40, 12],
      [42, 13], [43, 14], [43, 15], [43, 16], [42, 17], [41, 18], [40, 19]
    ];
    for (const [rx, ry] of treeRimMid) {
      ctx.fillRect(rx, ry, 1, 1);
    }

    ctx.fillStyle = '#c2dd6c';
    const treeRimHi: [number, number][] = [
      [30, 2], [31, 2], [32, 1], [33, 1], [34, 1], [35, 1], [36, 2], [37, 2],
      [38, 3], [39, 3], [40, 4], [41, 5], [42, 6], [42, 7], [43, 12], [43, 13]
    ];
    for (const [hx, hy] of treeRimHi) {
      ctx.fillRect(hx, hy, 1, 1);
    }

    ctx.fillStyle = '#e2f28e';
    const treeRimPeak: [number, number][] = [
      [32, 0], [33, 0], [34, 0], [35, 0], [38, 2], [39, 2], [41, 4]
    ];
    for (const [px, py] of treeRimPeak) {
      ctx.fillRect(px, py, 1, 1);
    }

    // Leaf cluster dither & micro-details
    ctx.fillStyle = '#33492c';
    ctx.fillRect(16, 26, 2, 2);
    ctx.fillRect(22, 28, 2, 2);
    ctx.fillRect(28, 24, 2, 2);

    ctx.fillStyle = '#618951';
    ctx.fillRect(18, 18, 2, 2);
    ctx.fillRect(24, 20, 2, 2);
    ctx.fillRect(16, 12, 2, 2);

    // Warm golden amber acorns / blossom accents in lit foliage
    ctx.fillStyle = '#d99726';
    ctx.fillRect(32, 9, 2, 2);
    ctx.fillRect(36, 14, 2, 2);
    ctx.fillRect(27, 15, 2, 2);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(32, 9, 1, 1);
    ctx.fillRect(36, 14, 1, 1);
  });

  // 8. Storybook Flowering Bush (Chunky Silhouette & Chamomile Daisies) (32x32)
  const bush = createPixelCanvasTexture(32, 32, (ctx) => {
    // 1. Soft Occlusion Ground Shadow
    ctx.fillStyle = '#141222';
    ctx.fillRect(4, 27, 24, 3);
    ctx.fillRect(6, 29, 20, 2);

    // 2. Gnarled wood core at base
    ctx.fillStyle = '#3a2215';
    ctx.fillRect(14, 24, 4, 4);
    ctx.fillStyle = '#1c1524';
    ctx.fillRect(13, 25, 2, 3);
    ctx.fillStyle = '#8f5024';
    ctx.fillRect(17, 24, 2, 3);

    // 3. Asymmetric Foliage Lobes
    // Deep shadow base (#181e29 violet-night & #172422 forest-slate)
    ctx.fillStyle = '#181e29';
    ctx.fillRect(4, 11, 22, 14);
    ctx.fillRect(7, 8, 18, 17);
    ctx.fillRect(2, 15, 26, 9);

    ctx.fillStyle = '#172422';
    ctx.fillRect(6, 10, 20, 14);
    ctx.fillRect(8, 7, 16, 16);

    // Textured olive body (#33492c, #425e37)
    ctx.fillStyle = '#33492c';
    ctx.fillRect(6, 10, 20, 13);
    ctx.fillRect(9, 7, 15, 14);

    ctx.fillStyle = '#425e37';
    ctx.fillRect(8, 8, 17, 12);
    ctx.fillRect(11, 6, 13, 11);

    // Upper-right foliage mass (#547a46, #699557)
    ctx.fillStyle = '#547a46';
    ctx.fillRect(11, 7, 14, 9);
    ctx.fillRect(14, 5, 10, 7);

    ctx.fillStyle = '#699557';
    ctx.fillRect(13, 6, 11, 7);
    ctx.fillRect(16, 4, 8, 5);

    // 4. Lit Edge / Warm Rim Pass (Upper-Right Key Light #98b656, #bee068)
    ctx.fillStyle = '#98b656';
    const bushRimMid: [number, number][] = [
      [14, 4], [15, 4], [16, 3], [17, 3], [18, 3], [19, 3], [20, 3], [21, 4], [22, 4],
      [23, 5], [24, 6], [25, 7], [25, 8], [26, 9], [26, 10], [24, 11]
    ];
    for (const [rx, ry] of bushRimMid) {
      ctx.fillRect(rx, ry, 1, 1);
    }

    ctx.fillStyle = '#bee068';
    const bushRimHi: [number, number][] = [
      [16, 2], [17, 2], [18, 2], [19, 2], [20, 2], [22, 3], [23, 4], [24, 5]
    ];
    for (const [hx, hy] of bushRimHi) {
      ctx.fillRect(hx, hy, 1, 1);
    }

    // Blooming chamomile daisies (warm linen petals, amber center)
    const daisies = [
      { x: 12, y: 13 },
      { x: 21, y: 11 },
      { x: 8, y: 18 },
    ];
    for (const d of daisies) {
      ctx.fillStyle = '#172422';
      ctx.fillRect(d.x - 1, d.y, 4, 2);
      ctx.fillStyle = '#ede8dd';
      ctx.fillRect(d.x, d.y - 1, 2, 1);
      ctx.fillRect(d.x - 1, d.y, 4, 1);
      ctx.fillRect(d.x, d.y + 1, 2, 1);
      ctx.fillStyle = '#d99726';
      ctx.fillRect(d.x, d.y, 1, 1);
    }

    // Wild berry accents
    ctx.fillStyle = '#b06b85';
    ctx.fillRect(17, 18, 2, 2);
    ctx.fillRect(24, 16, 2, 2);
    ctx.fillStyle = '#d99bb2';
    ctx.fillRect(17, 18, 1, 1);
    ctx.fillRect(24, 16, 1, 1);
  });

  // 9. Detailed Woven Wicker Basket with Soft Fleece Cushion (32x20)
  const wickerBasket = createPixelCanvasTexture(32, 20, (ctx) => {
    // Drop shadow
    ctx.fillStyle = '#1b130a';
    ctx.fillRect(4, 17, 24, 2);
    ctx.fillRect(6, 18, 20, 1);

    // Outer wicker body (#4a2408 shadow base)
    ctx.fillStyle = '#4a2408';
    ctx.fillRect(3, 4, 26, 14);

    // Braided top rim (y: 3..7)
    ctx.fillStyle = '#995015';
    ctx.fillRect(2, 4, 28, 3);
    // Braided highlight twist pattern
    ctx.fillStyle = '#e09038';
    for (let bx = 3; bx < 29; bx += 3) {
      ctx.fillRect(bx, 4, 2, 1);
      ctx.fillRect(bx + 1, 5, 2, 1);
    }
    ctx.fillStyle = '#f3b25e';
    for (let bx = 4; bx < 28; bx += 6) {
      ctx.fillRect(bx, 4, 1, 1);
    }

    // Woven basketweave body rows (y: 8..16)
    for (let y = 8; y <= 16; y += 2) {
      // Horizontal weaver band
      ctx.fillStyle = '#a85c18';
      ctx.fillRect(3, y, 26, 2);
      ctx.fillStyle = '#dd923c';
      ctx.fillRect(4, y, 24, 1);

      // Alternating vertical stakes
      ctx.fillStyle = '#4a2408';
      const offset = (y % 4 === 0) ? 0 : 2;
      for (let x = 4 + offset; x < 28; x += 4) {
        ctx.fillRect(x, y, 1, 2);
      }
    }

    // Soft cozy fleece cushion inside
    // Deep fold shadow
    ctx.fillStyle = '#dfceb3';
    ctx.fillRect(5, 5, 22, 9);
    // Warm cream fleece body (#fef9ee)
    ctx.fillStyle = '#fef9ee';
    ctx.fillRect(6, 6, 20, 7);

    // Tufted cushion button indents
    ctx.fillStyle = '#b09f87';
    ctx.fillRect(10, 8, 2, 1);
    ctx.fillRect(16, 8, 2, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 9, 2, 1);
    ctx.fillRect(16, 9, 2, 1);

    // Draped cozy pink quilt / blanket corner over right rim
    ctx.fillStyle = '#be185d';
    ctx.fillRect(20, 7, 7, 9);
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(21, 7, 5, 8);
    // Blanket fringe / border stitch
    ctx.fillStyle = '#fbcfe8';
    ctx.fillRect(20, 15, 7, 1);
    ctx.fillRect(21, 16, 1, 1);
    ctx.fillRect(23, 16, 1, 1);
    ctx.fillRect(25, 16, 1, 1);
  });

  // 10. Tier 1: Cozy Storybook Cottage (96x80)
  const cottage = createPixelCanvasTexture(96, 80, (ctx) => {
    // 1. Stone Chimney with River Stones & Curling Chimney Smoke (Left)
    // Chimney base behind roof
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(13, 7, 14, 38);

    // River stone masonry with individual stones
    const stones: { x: number; y: number; w: number; h: number; color: string; hi: string }[] = [
      { x: 14, y: 10, w: 6, h: 4, color: '#475569', hi: '#94a3b8' },
      { x: 21, y: 10, w: 5, h: 4, color: '#56657a', hi: '#94a3b8' },
      { x: 14, y: 15, w: 5, h: 4, color: '#64748b', hi: '#cbd5e1' },
      { x: 20, y: 15, w: 6, h: 4, color: '#475569', hi: '#94a3b8' },
      { x: 14, y: 20, w: 6, h: 4, color: '#56657a', hi: '#94a3b8' },
      { x: 21, y: 20, w: 5, h: 4, color: '#374151', hi: '#64748b' },
      { x: 14, y: 25, w: 5, h: 4, color: '#475569', hi: '#94a3b8' },
      { x: 20, y: 25, w: 6, h: 4, color: '#64748b', hi: '#cbd5e1' },
      { x: 14, y: 30, w: 6, h: 4, color: '#374151', hi: '#64748b' },
      { x: 21, y: 30, w: 5, h: 4, color: '#56657a', hi: '#94a3b8' },
    ];
    for (const s of stones) {
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = s.hi;
      ctx.fillRect(s.x, s.y, s.w, 1);
    }

    // Chimney cap
    ctx.fillStyle = '#334155';
    ctx.fillRect(11, 6, 18, 4);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(11, 6, 18, 1);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(15, 5, 10, 2); // flue hole

    // Curling chimney smoke drifting up and right
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillRect(18, 2, 5, 3);
    ctx.fillRect(19, 1, 3, 1);
    ctx.fillStyle = 'rgba(240, 248, 255, 0.45)';
    ctx.fillRect(23, 0, 6, 3);
    ctx.fillRect(24, 3, 4, 1);
    ctx.fillStyle = 'rgba(225, 240, 255, 0.25)';
    ctx.fillRect(29, 0, 5, 2);

    // 2. Multi-Layered Slate Roof with Overlapping Shadows
    // Gable background
    ctx.fillStyle = '#253042';
    ctx.beginPath();
    ctx.moveTo(48, 14);
    ctx.lineTo(2, 46);
    ctx.lineTo(94, 46);
    ctx.closePath();
    ctx.fill();

    // 8 distinct overlapping courses of slate shingles (#253042, #384860, #4d6382, #6882a8)
    const shingleCourses = [
      { y: 16, w: 12 },
      { y: 20, w: 22 },
      { y: 24, w: 32 },
      { y: 28, w: 44 },
      { y: 32, w: 56 },
      { y: 36, w: 68 },
      { y: 40, w: 78 },
      { y: 44, w: 88 },
    ];
    for (let c = 0; c < shingleCourses.length; c++) {
      const course = shingleCourses[c];
      const startX = 48 - (course.w >> 1);

      // Shingle course main body (#4d6382)
      ctx.fillStyle = '#4d6382';
      ctx.fillRect(startX, course.y, course.w, 4);

      // Overlapping shadow under previous row (#384860)
      ctx.fillStyle = '#384860';
      ctx.fillRect(startX, course.y, course.w, 1);

      // Bottom shingle bevel highlight (#6882a8)
      ctx.fillStyle = '#6882a8';
      ctx.fillRect(startX, course.y + 3, course.w, 1);

      // Vertical shingle cuts & shadows (#253042)
      ctx.fillStyle = '#253042';
      const offset = (c % 2) * 3;
      for (let sx = startX + 3 + offset; sx < startX + course.w - 2; sx += 6) {
        ctx.fillRect(sx, course.y, 1, 4);
      }
    }

    // Decorative roof ridge cap at peak
    ctx.fillStyle = '#6882a8';
    ctx.fillRect(44, 14, 8, 2);
    ctx.fillStyle = '#8fa7cc';
    ctx.fillRect(45, 14, 6, 1);

    // Deep under-eave drop shadow
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(6, 46, 84, 2);

    // 3. Walls: Stone Foundation & Cream Plaster with Timber Beams
    // Fieldstone foundation base
    ctx.fillStyle = '#334155';
    ctx.fillRect(10, 73, 76, 5);
    ctx.fillStyle = '#475569';
    for (let fx = 12; fx < 84; fx += 8) {
      ctx.fillRect(fx, 74, 6, 3);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(fx, 74, 6, 1);
      ctx.fillStyle = '#334155';
    }

    // Warm cream plaster walls (#f5ebd9, shaded #e6d8c0)
    ctx.fillStyle = '#e6d8c0'; // shadow under eave
    ctx.fillRect(11, 48, 74, 4);
    ctx.fillStyle = '#f5ebd9'; // main plaster body
    ctx.fillRect(11, 52, 74, 21);

    // Warm timber beams (#3d200e)
    ctx.fillStyle = '#3d200e';
    // Top plate beam
    ctx.fillRect(11, 48, 74, 3);
    // Bottom sill beam
    ctx.fillRect(11, 71, 74, 3);
    // Vertical timber posts
    ctx.fillRect(11, 48, 4, 26);  // left post
    ctx.fillRect(81, 48, 4, 26);  // right post
    ctx.fillRect(45, 48, 4, 26);  // center post

    // Tudor storybook diagonal timber braces
    for (let d = 0; d < 6; d++) {
      ctx.fillRect(15 + d, 66 - d * 2, 2, 2); // left wing diagonal
      ctx.fillRect(79 - d, 66 - d * 2, 2, 2); // right wing diagonal
    }

    // Timber highlight edges
    ctx.fillStyle = '#6e3c1b';
    ctx.fillRect(11, 48, 74, 1);
    ctx.fillRect(11, 71, 74, 1);

    // 4. Wooden Front Door (Left side)
    ctx.fillStyle = '#261205'; // door frame
    ctx.fillRect(22, 53, 16, 21);
    // Cedar vertical planks (#7c3d17, #94491c)
    ctx.fillStyle = '#7c3d17';
    ctx.fillRect(24, 55, 12, 19);
    ctx.fillStyle = '#94491c';
    ctx.fillRect(25, 55, 3, 19);
    ctx.fillRect(31, 55, 3, 19);
    // Vertical groove lines
    ctx.fillStyle = '#4a2209';
    ctx.fillRect(28, 55, 1, 19);

    // Iron strap hinges
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(23, 57, 8, 2);
    ctx.fillRect(23, 68, 8, 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(24, 57, 1, 1);
    ctx.fillRect(24, 68, 1, 1);

    // Brass doorknob / ring
    ctx.fillStyle = '#facc15';
    ctx.fillRect(33, 64, 2, 3);
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(34, 65, 1, 2);

    // Heavy stone doorstep
    ctx.fillStyle = '#475569';
    ctx.fillRect(20, 74, 20, 3);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(20, 74, 20, 1);

    // 5. Glowing Leaded Glass Window & Blooming Flowerbox (Right side)
    // Timber window frame
    ctx.fillStyle = '#3d200e';
    ctx.fillRect(54, 52, 22, 16);

    // Warm golden glowing light inside (#fef08a, warm amber #f59e0b)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(56, 54, 18, 12);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(57, 55, 16, 10);

    // Diamond leaded mullions
    ctx.fillStyle = '#3d200e';
    ctx.fillRect(64, 54, 2, 12); // vertical bar
    ctx.fillRect(56, 59, 18, 2); // horizontal bar
    // Diagonal leaded glass lattice pips
    ctx.fillRect(60, 56, 1, 1);
    ctx.fillRect(68, 56, 1, 1);
    ctx.fillRect(60, 62, 1, 1);
    ctx.fillRect(68, 62, 1, 1);

    // Blooming Flowerbox beneath window
    // Cedar box (#522b13, highlight #82451f)
    ctx.fillStyle = '#3d200e';
    ctx.fillRect(53, 67, 24, 5);
    ctx.fillStyle = '#522b13';
    ctx.fillRect(54, 68, 22, 4);
    ctx.fillStyle = '#82451f';
    ctx.fillRect(53, 67, 24, 1);

    // Overflowing greenery foliage (#2d5a27, #3f7a37, #529c48)
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(54, 66, 22, 2);
    ctx.fillStyle = '#3f7a37';
    ctx.fillRect(55, 65, 20, 2);
    ctx.fillStyle = '#529c48';
    ctx.fillRect(56, 64, 18, 2);
    // Trailing vine leaves hanging down
    ctx.fillRect(55, 71, 2, 2);
    ctx.fillRect(64, 71, 2, 3);
    ctx.fillRect(73, 71, 2, 2);

    // Abundant blooming flowers
    // Pink roses
    ctx.fillStyle = '#db2777';
    ctx.fillRect(56, 63, 3, 3);
    ctx.fillRect(67, 63, 3, 3);
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(56, 63, 2, 2);
    ctx.fillRect(67, 63, 2, 2);

    // Chamomile daisies
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(61, 63, 3, 3);
    ctx.fillRect(72, 63, 3, 3);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(62, 64, 1, 1);
    ctx.fillRect(73, 64, 1, 1);

    // 6. Ivy and Warm Lantern Accents
    // Ivy creeping up left wall and chimney
    ctx.fillStyle = '#275222';
    ctx.fillRect(11, 42, 3, 8);
    ctx.fillRect(13, 38, 2, 6);
    ctx.fillStyle = '#529c48';
    ctx.fillRect(12, 40, 2, 3);
    ctx.fillRect(11, 46, 2, 2);

    // Warm lantern next to door
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, 56, 3, 5); // iron frame
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(41, 57, 1, 3); // golden amber glow
  });

  // 11. Tier 2: Storybook Country Villa (140x96)
  const villa = createPixelCanvasTexture(140, 96, (ctx) => {
    // 1. Stone Foundation & Plinth (y: 84..95)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 84, 120, 11);
    const foundationStones = [
      { x: 12, y: 86, w: 18, h: 8, col: '#475569', hi: '#94a3b8' },
      { x: 32, y: 86, w: 22, h: 8, col: '#56657a', hi: '#94a3b8' },
      { x: 56, y: 86, w: 28, h: 8, col: '#475569', hi: '#94a3b8' },
      { x: 86, y: 86, w: 22, h: 8, col: '#64748b', hi: '#cbd5e1' },
      { x: 110, y: 86, w: 18, h: 8, col: '#56657a', hi: '#94a3b8' },
    ];
    for (const s of foundationStones) {
      ctx.fillStyle = s.col;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = s.hi;
      ctx.fillRect(s.x, s.y, s.w, 1);
    }

    // 2. Twin River-Stone Chimneys with Warm Curling Smoke
    // Left chimney (x: 22..34, y: 6..36)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(22, 6, 14, 30);
    ctx.fillStyle = '#475569';
    ctx.fillRect(23, 8, 12, 28);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(24, 9, 10, 4);
    ctx.fillRect(24, 17, 10, 4);
    ctx.fillStyle = '#334155';
    ctx.fillRect(21, 5, 16, 3); // cap

    // Right chimney (x: 104..116, y: 6..36)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(104, 6, 14, 30);
    ctx.fillStyle = '#475569';
    ctx.fillRect(105, 8, 12, 28);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(106, 9, 10, 4);
    ctx.fillRect(106, 17, 10, 4);
    ctx.fillStyle = '#334155';
    ctx.fillRect(103, 5, 16, 3); // cap

    // Smoke puffs drifting rightward in the wind
    ctx.fillStyle = 'rgba(254, 240, 138, 0.45)'; // warm golden hour smoke
    ctx.fillRect(28, 2, 4, 3);
    ctx.fillRect(32, -1, 5, 3);
    ctx.fillRect(110, 2, 4, 3);
    ctx.fillRect(114, -1, 5, 3);

    // 3. Multi-Tiered Slate Shingle Roof (y: 20..54)
    const roofTiers = [
      { y: 20, w: 28, h: 5 },
      { y: 25, w: 48, h: 5 },
      { y: 30, w: 72, h: 5 },
      { y: 35, w: 96, h: 5 },
      { y: 40, w: 118, h: 5 },
      { y: 45, w: 134, h: 5 },
      { y: 50, w: 140, h: 4 },
    ];
    for (let i = 0; i < roofTiers.length; i++) {
      const rt = roofTiers[i];
      const rx = 70 - (rt.w >> 1);
      // Shadow underside
      ctx.fillStyle = '#202b3d';
      ctx.fillRect(rx, rt.y + rt.h - 1, rt.w, 1);
      // Slate body
      ctx.fillStyle = i % 2 === 0 ? '#384860' : '#455a78';
      ctx.fillRect(rx, rt.y, rt.w, rt.h - 1);
      // Warm upper-right sunlit bevel
      ctx.fillStyle = '#6882a8';
      ctx.fillRect(rx, rt.y, rt.w, 1);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(rx + (rt.w >> 1), rt.y, (rt.w >> 1), 1);
      // Shingle vertical score lines
      ctx.fillStyle = '#202b3d';
      for (let sx = rx + 6; sx < rx + rt.w - 4; sx += 8) {
        ctx.fillRect(sx, rt.y, 1, rt.h);
      }
    }

    // 4. Cream Plaster Walls & Tudor Timber Bracing (y: 54..84)
    ctx.fillStyle = '#e6d8c0'; // shadow under eave
    ctx.fillRect(14, 54, 112, 3);
    ctx.fillStyle = '#f7eedd'; // warm cream plaster
    ctx.fillRect(14, 57, 112, 27);

    // Heavy dark cedar timber posts and diagonals
    ctx.fillStyle = '#3d200e';
    // Perimeter frame
    ctx.fillRect(14, 54, 4, 30);
    ctx.fillRect(122, 54, 4, 30);
    ctx.fillRect(14, 82, 112, 3);
    // Vertical studs
    ctx.fillRect(38, 54, 4, 28);
    ctx.fillRect(66, 54, 4, 28);
    ctx.fillRect(94, 54, 4, 28);
    // Diagonal bracing
    for (let d = 0; d < 8; d++) {
      ctx.fillRect(18 + d * 2, 58 + d * 2, 3, 2);
      ctx.fillRect(118 - d * 2, 58 + d * 2, 3, 2);
    }
    // Warm sunlit bevels on timber rights
    ctx.fillStyle = '#824822';
    ctx.fillRect(41, 54, 1, 28);
    ctx.fillRect(69, 54, 1, 28);
    ctx.fillRect(97, 54, 1, 28);

    // 5. Grand Arched Double Door (x: 58..78, y: 60..84)
    ctx.fillStyle = '#261205';
    ctx.fillRect(58, 60, 20, 24);
    ctx.fillStyle = '#7c3d17';
    ctx.fillRect(59, 61, 18, 23);
    // Door planks
    ctx.fillStyle = '#4a2209';
    ctx.fillRect(67, 61, 2, 23);
    // Warm brass door handles
    ctx.fillStyle = '#facc15';
    ctx.fillRect(65, 72, 2, 3);
    ctx.fillRect(69, 72, 2, 3);

    // 6. Glowing Leaded Casement Windows (x: 22..34, 44..56, 80..92, 102..114)
    const winLocs = [22, 44, 80, 102];
    for (const wx of winLocs) {
      // Timber frame
      ctx.fillStyle = '#261205';
      ctx.fillRect(wx - 1, 60, 14, 16);
      // Warm amber interior glow
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(wx, 61, 12, 14);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(wx + 2, 62, 8, 10);
      // Leaded window grille
      ctx.fillStyle = '#3d200e';
      ctx.fillRect(wx + 5, 61, 2, 14);
      ctx.fillRect(wx, 67, 12, 2);

      // Flowerbox under window
      ctx.fillStyle = '#522b13';
      ctx.fillRect(wx - 2, 76, 16, 5);
      ctx.fillStyle = '#2d5a27';
      ctx.fillRect(wx - 1, 74, 14, 3);
      ctx.fillStyle = '#db2777';
      ctx.fillRect(wx, 73, 2, 2);
      ctx.fillRect(wx + 5, 73, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(wx + 10, 73, 2, 2);
    }
  });

  // 12. Tier 3: Aristocratic Courtyard Manor (180x110)
  const manor = createPixelCanvasTexture(180, 110, (ctx) => {
    // 1. Cut Ashlar Stone Plinth (y: 96..109)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(12, 96, 156, 13);
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = c % 2 === 0 ? '#475569' : '#56657a';
      ctx.fillRect(14 + c * 19, 98, 18, 10);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(14 + c * 19, 98, 18, 1);
    }

    // 2. High Slate Mansard Roof with Gilded Ridge (y: 16..54)
    // Central pediment / gable
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(90, 12);
    ctx.lineTo(8, 54);
    ctx.lineTo(172, 54);
    ctx.closePath();
    ctx.fill();

    // Layered slate courses
    for (let y = 18; y < 54; y += 4) {
      const w = Math.round(164 * ((y - 14) / 40));
      const rx = 90 - (w >> 1);
      ctx.fillStyle = (y % 8 === 0) ? '#28334a' : '#33415c';
      ctx.fillRect(rx, y, w, 4);
      // Sunlit rim on right side
      ctx.fillStyle = '#5c6b8a';
      ctx.fillRect(rx, y, w, 1);
      ctx.fillStyle = '#fed7aa'; // warm golden hour rim
      ctx.fillRect(rx + (w >> 1), y, (w >> 1), 1);
    }

    // 3. Ashlar Stone Facade Walls (y: 54..96)
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(18, 54, 144, 42);
    // Stone block horizontal mortar courses
    ctx.fillStyle = '#94a3b8';
    for (let my = 60; my <= 90; my += 6) {
      ctx.fillRect(18, my, 144, 1);
    }
    // Stone quoins (interlocking corner stones)
    ctx.fillStyle = '#64748b';
    for (let qy = 54; qy < 96; qy += 6) {
      const qw = (qy % 12 === 0) ? 8 : 5;
      ctx.fillRect(18, qy, qw, 5);
      ctx.fillRect(162 - qw, qy, qw, 5);
    }

    // 4. Grand Stone Portico & Arched Double Entrance (x: 76..104, y: 64..96)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(74, 62, 32, 34);
    ctx.fillStyle = '#475569';
    ctx.fillRect(76, 64, 28, 32);
    // Portico columns
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(76, 66, 4, 30);
    ctx.fillRect(100, 66, 4, 30);
    // Double oak doors
    ctx.fillStyle = '#261205';
    ctx.fillRect(81, 68, 18, 28);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(82, 69, 16, 27);
    ctx.fillStyle = '#3d1a04';
    ctx.fillRect(89, 69, 2, 27);
    // Brass knockers
    ctx.fillStyle = '#fde047';
    ctx.fillRect(86, 78, 2, 3);
    ctx.fillRect(92, 78, 2, 3);

    // 5. Four Arched Leaded Windows with Warm Golden Glow
    const manorWindows = [28, 50, 114, 136];
    for (const wx of manorWindows) {
      // Stone arched frame
      ctx.fillStyle = '#334155';
      ctx.fillRect(wx - 1, 62, 16, 26);
      // Warm glowing glass
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(wx, 63, 14, 24);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(wx + 2, 65, 10, 18);
      // Window mullions
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(wx + 6, 63, 2, 24);
      ctx.fillRect(wx, 73, 14, 2);
    }

    // 6. Ivy Growth on Manor Left & Brass Lantern Sconces
    ctx.fillStyle = '#1b3817';
    ctx.fillRect(18, 68, 5, 24);
    ctx.fillRect(23, 76, 4, 14);
    ctx.fillStyle = '#3b7433';
    ctx.fillRect(19, 70, 3, 20);
    ctx.fillStyle = '#6ec262';
    ctx.fillRect(20, 72, 2, 5);

    // Brass lanterns flanking entry
    ctx.fillStyle = '#fde047';
    ctx.fillRect(72, 72, 3, 5);
    ctx.fillRect(105, 72, 3, 5);
  });

  // 13. Tier 4: Grand Royal Library Palace Wing (210x120)
  const library = createPixelCanvasTexture(210, 120, (ctx) => {
    // 1. Foundation Base (y: 106..119)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(14, 106, 182, 13);
    for (let c = 0; c < 10; c++) {
      ctx.fillStyle = c % 2 === 0 ? '#475569' : '#56657a';
      ctx.fillRect(16 + c * 18, 108, 16, 10);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(16 + c * 18, 108, 16, 1);
    }

    // 2. High Imperial Purple-Slate Roof & Marble Balustrade (y: 14..54)
    ctx.fillStyle = '#20122e';
    ctx.fillRect(16, 20, 178, 34);
    ctx.fillStyle = '#3b1c54';
    ctx.fillRect(18, 22, 174, 30);
    // Warm sunlit roof crest
    ctx.fillStyle = '#5c2d82';
    ctx.fillRect(18, 22, 174, 2);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(105, 22, 87, 2);

    // Classical Marble Balustrade with pillars (y: 12..20)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(16, 19, 178, 2);
    ctx.fillRect(16, 12, 178, 2);
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#f1f5f9' : '#cbd5e1';
      ctx.fillRect(20 + i * 8, 14, 3, 5);
    }

    // 3. Palace Library Facade & Classical Columns (y: 54..106)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(20, 54, 170, 52);
    // Fluted Classical Pillars
    const colLocs = [22, 48, 74, 134, 160, 186];
    for (const cx of colLocs) {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(cx, 54, 6, 52);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(cx + 1, 54, 4, 52);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cx + 2, 54, 2, 52);
      // Capital & plinth
      ctx.fillStyle = '#475569';
      ctx.fillRect(cx - 2, 54, 10, 3);
      ctx.fillRect(cx - 2, 103, 10, 3);
    }

    // 4. Five Cathedral Stained Glass Windows with Amber & Amethyst Glow
    const libraryWindows = [30, 56, 116, 142, 168];
    for (const wx of libraryWindows) {
      // Gothic arched stone surround
      ctx.fillStyle = '#1e1b2e';
      ctx.fillRect(wx - 1, 58, 16, 38);
      // Glowing interior light
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(wx, 59, 14, 36);
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(wx + 2, 61, 10, 32);
      ctx.fillStyle = '#fde047'; // warm amber central pane
      ctx.fillRect(wx + 4, 68, 6, 18);
      // Lead tracery
      ctx.fillStyle = '#1e1b2e';
      ctx.fillRect(wx + 6, 59, 2, 36);
      ctx.fillRect(wx, 74, 14, 2);
    }

    // 5. Grand Gilded Portal (x: 84..124, y: 64..106)
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(84, 64, 40, 42);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(86, 66, 36, 40);
    // Gilded arch trim
    ctx.fillStyle = '#fde047';
    ctx.fillRect(86, 66, 36, 3);
    ctx.fillRect(86, 66, 3, 40);
    ctx.fillRect(119, 66, 3, 40);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(103, 66, 2, 40); // center division
    // Brass door handles
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(100, 84, 2, 4);
    ctx.fillRect(106, 84, 2, 4);
  });

  // 14. Tier 5: Celestial Chateau & Starlight Observatory (240x130)
  const observatory = createPixelCanvasTexture(240, 130, (ctx) => {
    // 1. Monumental Foundation Plinth (y: 114..129)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(16, 114, 208, 15);
    for (let c = 0; c < 12; c++) {
      ctx.fillStyle = c % 2 === 0 ? '#334155' : '#475569';
      ctx.fillRect(18 + c * 17, 116, 15, 12);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(18 + c * 17, 116, 15, 1);
    }

    // 2. Central Copper-Patina Celestial Rotunda Dome (y: 6..44)
    // Dark shadow base
    ctx.fillStyle = '#0f241d';
    ctx.beginPath();
    ctx.arc(120, 44, 36, Math.PI, 0);
    ctx.fill();
    // Aged copper patina green dome
    ctx.fillStyle = '#1b4d45';
    ctx.beginPath();
    ctx.arc(120, 44, 34, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#2a7266';
    ctx.beginPath();
    ctx.arc(120, 44, 31, Math.PI, 0);
    ctx.fill();

    // Gilded Brass Ribs & Upper-Right Sunlit Rim
    ctx.fillStyle = '#d97706';
    ctx.fillRect(118, 10, 4, 34);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(120, 44, 34, -Math.PI / 2, 0); // lit quarter rim
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    // Telescope Slit with Starry Amber/Cyan Light
    ctx.fillStyle = '#020617';
    ctx.fillRect(116, 14, 8, 30);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(118, 18, 4, 22);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(119, 24, 2, 4);

    // 3. Flanking Gothic Crystal Spires (x: 32..44, 196..208, y: 12..50)
    const spires = [32, 196];
    for (const sx of spires) {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(sx, 20, 12, 34);
      ctx.fillStyle = '#3730a3';
      ctx.fillRect(sx + 2, 22, 8, 30);
      // Glowing amethyst crystal tip
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(sx + 4, 12, 4, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + 5, 9, 2, 4);
    }

    // 4. Grand Chateau Facade (y: 44..114)
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(24, 44, 192, 70);
    // Dark stone horizontal stringcourses
    ctx.fillStyle = '#64748b';
    ctx.fillRect(24, 68, 192, 2);
    ctx.fillRect(24, 92, 192, 2);

    // Fluted Corinthian pilasters
    const pillars = [26, 60, 94, 140, 174, 208];
    for (const px of pillars) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(px, 44, 6, 70);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(px + 1, 44, 4, 70);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 2, 44, 2, 70);
    }

    // 5. Six Tall Arched Celestial Windows with Golden Glow
    const chateauWindows = [36, 70, 104, 148, 182];
    for (const wx of chateauWindows) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(wx - 1, 48, 18, 40);
      // Warm amber starlight interior glow
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(wx, 49, 16, 38);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(wx + 2, 51, 12, 34);
      // Starlight mullions
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(wx + 7, 49, 2, 38);
      ctx.fillRect(wx, 67, 16, 2);
    }

    // 6. Royal Zodiac Double Portal (x: 104..136, y: 74..114)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(102, 72, 36, 42);
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(104, 74, 32, 40);
    // Gilded zodiac arch
    ctx.fillStyle = '#fde047';
    ctx.fillRect(104, 74, 32, 3);
    ctx.fillRect(104, 74, 3, 40);
    ctx.fillRect(133, 74, 3, 40);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(119, 74, 2, 40);
    // Starry brass knockers
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(114, 90, 3, 3);
    ctx.fillRect(123, 90, 3, 3);
  });

  cachedAssets = {
    cottage,
    villa,
    manor,
    library,
    observatory,
    lawn,
    lawnFlowers,
    path,
    porchWood,
    hedge,
    water,
    tree,
    bush,
    wickerBasket,
  };

  return cachedAssets;
}
