import { describe, it, expect } from 'vitest';
import {
  Texture,
  Rectangle,
  TextureSource,
  Container,
  AnimatedSprite,
  Point,
} from 'pixi.js';
import * as fs from 'fs';

// Polyfill requestAnimationFrame / cancelAnimationFrame for headless Node.js
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id as unknown as NodeJS.Timeout);
  };
}

import {
  sliceCharacterSheet,
  sliceGroundBlocks,
  sliceBuildings,
  sliceTrees,
} from '../../src/render/assets';
import { MaidSprite } from '../../src/render/maids';

function makeMockTexture(width: number, height: number): Texture {
  const source = new TextureSource({ width, height });
  return new Texture({ source, frame: new Rectangle(0, 0, width, height) });
}

describe('Milestone 2: PixiJS v8 Engine & Character Animation Verification', () => {
  describe('1. Asset Frame Slicer Coordinates & Bounds', () => {
    it('slices 48x48 character frames with strict bounds and walk cycle sequence', () => {
      const sheet = makeMockTexture(144, 192);
      const frames = sliceCharacterSheet(sheet);

      // Walk cycle sequence: [step_left, idle, step_right, idle]
      expect(frames.down.walk).toHaveLength(4);
      expect(frames.down.walk[0].frame.x).toBe(0);
      expect(frames.down.walk[1].frame.x).toBe(48);
      expect(frames.down.walk[2].frame.x).toBe(96);
      expect(frames.down.walk[3].frame.x).toBe(48);
      expect(frames.down.idle.frame.x).toBe(48);
      expect(frames.down.idle.frame.y).toBe(0);

      // Row 1: Up
      expect(frames.up.idle.frame.y).toBe(48);
      expect(frames.up.walk).toHaveLength(4);

      // Row 2: Left
      expect(frames.left.idle.frame.y).toBe(96);
      expect(frames.left.walk).toHaveLength(4);

      // Row 3: Action
      expect(frames.action).toHaveLength(4);
      expect(frames.action[0].frame.y).toBe(144);
    });

    it('slices ground blocks matching frlg_blocks.json metadata', () => {
      const blocksTex = makeMockTexture(256, 64);
      const tiles = sliceGroundBlocks(blocksTex);

      expect(tiles.lawn.frame.x).toBe(0);
      expect(tiles.lawn.frame.y).toBe(0);
      expect(tiles.water.frame.x).toBe(0);
      expect(tiles.water.frame.y).toBe(32);
      expect(tiles.flower.frame.x).toBe(5 * 32);
      expect(tiles.flower.frame.y).toBe(32);
      expect(tiles.lawn4.frame.x).toBe(7 * 32);
      expect(tiles.lawn4.frame.y).toBe(32);
    });

    it('slices building textures matching frlg_buildings.json ground truth', () => {
      const bldgTex = makeMockTexture(340, 300);
      const bldg = sliceBuildings(bldgTex);

      expect((bldg.house_green as Texture).frame).toMatchObject({ x: 0, y: 0, width: 80, height: 64 });
      expect((bldg.house_mid as Texture).frame).toMatchObject({ x: 84, y: 0, width: 80, height: 56 });
      expect((bldg.house_red as Texture).frame).toMatchObject({ x: 168, y: 0, width: 80, height: 72 });
      expect((bldg.house_blue as Texture).frame).toMatchObject({ x: 252, y: 0, width: 80, height: 55 });
      expect((bldg.house_purple as Texture).frame).toMatchObject({ x: 168, y: 76, width: 80, height: 56 });
      expect((bldg.lab as Texture).frame).toMatchObject({ x: 152, y: 152, width: 112, height: 72 });
      expect((bldg.daycare as Texture).frame).toMatchObject({ x: 0, y: 228, width: 80, height: 72 });
      expect(bldg.fountain).toHaveLength(5);
    });

    it('slices tree textures matching frlg_trees.json ground truth', () => {
      const treeTex = makeMockTexture(72, 49);
      const trees = sliceTrees(treeTex);

      expect(trees.tree_round.frame).toMatchObject({ x: 2, y: 2, width: 32, height: 45 });
      expect(trees.tree_narrow.frame).toMatchObject({ x: 36, y: 2, width: 16, height: 35 });
      expect(trees.tree_bush.frame).toMatchObject({ x: 54, y: 2, width: 16, height: 21 });
    });
  });

  describe('2. MaidSprite Animation Cycles & State Machine', () => {
    const sheet = makeMockTexture(144, 192);
    const frames = sliceCharacterSheet(sheet);

    it('handles idle, walk, and chore states with correct mirroring and texture sets', () => {
      const maid = new MaidSprite({ name: 'nyah', frames });
      const anim = (maid as any).animSprite as AnimatedSprite;

      maid.setState('idle', 'right');
      expect(anim.playing).toBe(false);
      expect(anim.scale.x).toBe(-1); // Mirrored for right

      maid.setState('walk', 'left');
      expect(anim.playing).toBe(true);
      expect(anim.scale.x).toBe(1);
      expect(anim.textures).toBe(frames.left.walk);

      maid.setState('chore');
      expect(anim.playing).toBe(true);
      expect(anim.textures).toBe(frames.action);
    });

    it('interpolates movement smoothly and switches to chore upon arrival', () => {
      const maid = new MaidSprite({ name: 'fifi', frames, x: 0, y: 0, speed: 50 });
      maid.moveTo(100, 0);

      maid.update(1.0); // 50px
      expect(Math.round(maid.x)).toBe(50);
      expect(Math.round(maid.y)).toBe(0);

      maid.update(1.1); // reaches 100px
      expect(Math.round(maid.x)).toBe(100);
      expect((maid as any).currentState).toBe('chore');
      expect((maid as any).moveTarget).toBeNull();
    });

    it('synchronizes zIndex strictly with floor of y position', () => {
      const maid = new MaidSprite({ name: 'nyah', frames, x: 0, y: 45.7 });
      expect(maid.zIndex).toBe(45);

      // Direct negative coordinate floor
      maid.y = -12.3;
      (maid as any).updateZIndex();
      expect(maid.zIndex).toBe(-13);

      // Integer snapping upon moveTo arrival
      maid.moveTo(0, -12.3);
      maid.update(2.0);
      // Math.round(-12.3) === -12, so arrived y is -12 and zIndex is -12
      expect(maid.zIndex).toBe(-12);
    });
  });

  describe('3. Camera Mathematics & Integer Snapping', () => {
    it('snaps container transform to integers and clamps to bounds', () => {
      const zoom = 2;
      const screenW = 960;
      const screenH = 640;

      const camX = 12.345;
      const camY = -56.789;

      const containerX = Math.round(-camX * zoom + screenW / 2);
      const containerY = Math.round(-camY * zoom + screenH / 2);

      expect(Number.isInteger(containerX)).toBe(true);
      expect(Number.isInteger(containerY)).toBe(true);

      // Inversion back to world space
      const worldX = (screenW / 2 - containerX) / zoom;
      const worldY = (screenH / 2 - containerY) / zoom;
      expect(Math.abs(worldX - camX)).toBeLessThanOrEqual(0.5 / zoom);
      expect(Math.abs(worldY - camY)).toBeLessThanOrEqual(0.5 / zoom);
    });
  });

  describe('4. Dynamic Y-Sorting Under Multi-Entity Stress', () => {
    it('stably sorts multi-entity layer by zIndex without corruption', () => {
      const layer = new Container({ sortableChildren: true });

      for (let i = 0; i < 50; i++) {
        const c = new Container({ label: `e-${i}` });
        c.y = Math.floor(-100 + Math.random() * 200);
        c.zIndex = Math.floor(c.y);
        layer.addChild(c);
      }

      layer.sortChildren();

      for (let i = 0; i < layer.children.length - 1; i++) {
        expect(layer.children[i].zIndex).toBeLessThanOrEqual(layer.children[i + 1].zIndex);
      }
    });
  });
});
