// src/render/collisionRegistry.ts

export interface WorldCollider {
  id?: string;
  label: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  zoneId?: string;
  enabled?: boolean;
}

/**
 * Universal Spatial Navigation and Collision Registry for IdleNyah.
 * Enforces the Universal Spatial & Collision Contract:
 * 1. Self-declaring entities register their physical ground-contact footprints.
 * 2. Ground-contact law: footprints cover strictly the soil contact area.
 * 3. Closed-loop navigation with smooth wall-sliding predicate checks.
 */
export class CollisionRegistry {
  private colliders = new Map<string, WorldCollider>();

  constructor(initialColliders: WorldCollider[] = []) {
    for (const c of initialColliders) {
      this.register(c);
    }
  }

  /**
   * Registers a self-declaring entity footprint into the spatial collision registry.
   */
  public register(collider: WorldCollider): void {
    const key = collider.id || collider.label;
    this.colliders.set(key, {
      ...collider,
      id: key,
      enabled: collider.enabled ?? true,
    });
  }

  /**
   * Removes a collider by its identifier or label.
   */
  public unregister(key: string): void {
    this.colliders.delete(key);
  }

  /**
   * Toggles active blocking status of a specific collider footprint.
   */
  public setColliderEnabled(key: string, enabled: boolean): void {
    const c = this.colliders.get(key);
    if (c) {
      c.enabled = enabled;
    }
  }

  /**
   * Toggles all collider footprints associated with a territory zone.
   */
  public setZoneCollidersEnabled(zoneId: string, enabled: boolean): void {
    for (const c of this.colliders.values()) {
      if (c.zoneId === zoneId) {
        c.enabled = enabled;
      }
    }
  }

  /**
   * Returns list of currently active or all registered colliders.
   */
  public getColliders(onlyEnabled = true): WorldCollider[] {
    const list: WorldCollider[] = [];
    for (const c of this.colliders.values()) {
      if (!onlyEnabled || c.enabled !== false) {
        list.push(c);
      }
    }
    return list;
  }

  /**
   * Unified spatial predicate: verifies if a circular body radius around (x, y)
   * is entirely clear of all active blocking obstacle footprints.
   */
  public isWalkable(x: number, y: number, radius = 8): boolean {
    for (const c of this.colliders.values()) {
      if (c.enabled === false) continue;
      if (
        x + radius > c.minX &&
        x - radius < c.maxX &&
        y + radius > c.minY &&
        y - radius < c.maxY
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Closed-loop navigation solver:
   * Tests candidate movement step and resolves collisions via tangent wall-sliding.
   * If both direct and sliding paths are blocked, safely halts the entity at current position.
   */
  public tryMove(
    currentX: number,
    currentY: number,
    targetX: number,
    targetY: number,
    radius = 8
  ): { x: number; y: number; collided: boolean } {
    // 1. Direct path check
    if (this.isWalkable(targetX, targetY, radius)) {
      return { x: targetX, y: targetY, collided: false };
    }

    // 2. Wall sliding: try X movement only
    if (targetX !== currentX && this.isWalkable(targetX, currentY, radius)) {
      return { x: targetX, y: currentY, collided: true };
    }

    // 3. Wall sliding: try Y movement only
    if (targetY !== currentY && this.isWalkable(currentX, targetY, radius)) {
      return { x: currentX, y: targetY, collided: true };
    }

    // 4. Fully blocked: halt at current position
    return { x: currentX, y: currentY, collided: true };
  }
}
