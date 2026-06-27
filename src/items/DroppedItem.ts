import * as THREE from 'three';
import { ITEMS, Inventory } from './ItemRegistry';
import { BLOCK_DEFS } from '../shared/blocks';
import { ITEM_PICKUP_RADIUS } from '../shared/constants';

/**
 * A single floating dropped item entity in the world.
 * Rendered as a small colored cube with bobbing and rotation animation.
 */
export class DroppedItem {
  mesh: THREE.Group;
  itemId: string;
  count: number;
  position: THREE.Vector3;
  createdAt: number;

  constructor(
    itemId: string,
    count: number,
    position: THREE.Vector3,
    scene: THREE.Scene
  ) {
    this.itemId = itemId;
    this.count = count;
    this.position = position.clone();
    this.createdAt = Date.now();


    this.mesh = new THREE.Group();

    // Determine color from block definition or default white
    let color = 0xffffff;
    const itemDef = ITEMS[itemId];
    if (itemDef && itemDef.blockType !== undefined) {
      const blockDef = BLOCK_DEFS[itemDef.blockType as number];
      if (blockDef) {
        const [r, g, b] = blockDef.color;
        color = new THREE.Color(r, g, b).getHex();
      }
    }

    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const material = new THREE.MeshLambertMaterial({ color });
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;

    this.mesh.add(cube);
    this.mesh.position.copy(this.position);

    scene.add(this.mesh);
  }
}

/**
 * Manages all dropped items in the world — spawning, animation,
 * player pickup, and despawning.
 */
export class DroppedItemManager {
  items: DroppedItem[];
  private scene: THREE.Scene;

  /** Items older than this (ms) are automatically despawned */
  private static readonly DESPAWN_TIME_MS = 60_000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.items = [];
  }

  /**
   * Spawn a new dropped item at the given world position.
   */
  spawnDrop(itemId: string, count: number, position: THREE.Vector3): void {
    const item = new DroppedItem(itemId, count, position, this.scene);
    this.items.push(item);
  }

  /**
   * Tick all dropped items — animate, check pickup, despawn expired.
   *
   * @param dt          — delta time in seconds
   * @param playerPos   — current player world position
   * @param inventory   — player inventory for pickup
   */
  update(dt: number, playerPos: THREE.Vector3, inventory: Inventory): void {
    const now = Date.now();
    const toRemove: DroppedItem[] = [];

    for (const item of this.items) {
      // Bobbing animation
      item.mesh.position.y =
        item.position.y + Math.sin(now * 0.003) * 0.15;

      // Slow rotation
      item.mesh.rotation.y += dt * 2;

      // Check player pickup distance
      const dist = playerPos.distanceTo(item.mesh.position);
      if (dist < ITEM_PICKUP_RADIUS) {
        const added = inventory.addItem(item.itemId, item.count);
        if (added) {
          toRemove.push(item);
          continue;
        }
      }

      // Despawn after timeout
      if (now - item.createdAt > DroppedItemManager.DESPAWN_TIME_MS) {
        toRemove.push(item);
      }
    }

    // Clean up
    for (const item of toRemove) {
      this.removeItem(item);
    }
  }

  /**
   * Remove a dropped item from the scene and internal list.
   */
  removeItem(item: DroppedItem): void {
    this.scene.remove(item.mesh);

    // Dispose geometry / material
    item.mesh.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    const idx = this.items.indexOf(item);
    if (idx !== -1) {
      this.items.splice(idx, 1);
    }
  }
}
