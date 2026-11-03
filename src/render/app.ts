// src/render/app.ts
import { Application, TextureSource } from 'pixi.js';

// Configure global nearest-neighbor filtering for crisp retro pixel art
TextureSource.defaultOptions.scaleMode = 'nearest';

export interface PixiAppInitOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  background?: string | number;
}

/**
 * Creates and initializes a PixiJS v8 Application configured for authentic pixel art.
 * Follows v8 lifecycle requirements: new Application() + await app.init().
 */
export async function createPixiApp(options: PixiAppInitOptions): Promise<Application> {
  // Re-verify nearest-neighbor scaleMode before texture operations
  TextureSource.defaultOptions.scaleMode = 'nearest';

  const app = new Application();

  await app.init({
    width: options.width ?? 960,
    height: options.height ?? 640,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: false,        // CRITICAL: false prevents blurry MSAA edge smoothing
    roundPixels: true,      // CRITICAL: true snaps scene graph coordinates to integer pixels
    background: options.background ?? '#1a1820',
    preference: 'webgl',
    autoStart: true,
  });

  // Append canvas element to DOM container and allow responsive scaling
  options.container.appendChild(app.canvas);
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';

  return app;
}

/**
 * Cleanly tears down PixiJS Application releasing global GPU pools and caches.
 */
export function destroyPixiApp(app: Application): void {
  app.destroy(
    { removeView: true, releaseGlobalResources: true },
    { children: true, texture: true, textureSource: true }
  );
}
