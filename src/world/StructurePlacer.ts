import * as THREE from 'three';
import { AssetLoader } from '../services/AssetLoader';
import { getAssetById } from '../assets/manifest';

/**
 * Places GLB model instances in the world at specified positions.
 * Manages a registry of placed structures for removal and updates.
 */
export class StructurePlacer {
  private scene: THREE.Scene;
  private assetLoader: AssetLoader;
  public placedStructures: Map<string, THREE.Group>;

  constructor(scene: THREE.Scene, assetLoader: AssetLoader) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.placedStructures = new Map();
  }

  /**
   * Build a unique map key from position coordinates.
   */
  private positionKey(position: THREE.Vector3): string {
    return `${position.x.toFixed(1)}_${position.y.toFixed(1)}_${position.z.toFixed(1)}`;
  }

  /**
   * Place a GLB asset into the scene.
   *
   * @param assetId   — id from the asset manifest
   * @param position  — world position
   * @param rotation  — optional Euler rotation
   * @param scaleOverride — optional override for the manifest's default scale
   * @returns the placed THREE.Group
   */
  async placeAsset(
    assetId: string,
    position: THREE.Vector3,
    rotation?: THREE.Euler,
    scaleOverride?: number
  ): Promise<THREE.Group> {
    const entry = getAssetById(assetId);
    if (!entry) {
      throw new Error(`Asset id "${assetId}" not found in manifest`);
    }

    const group = await this.assetLoader.load(entry.filename);
    const scale = scaleOverride ?? entry.scale;
    group.scale.set(scale, scale, scale);
    group.position.copy(position);

    if (rotation) {
      group.rotation.copy(rotation);
    }

    // Torches emit warm point light
    if (assetId === 'torch') {
      const light = new THREE.PointLight(0xffaa33, 2, 12);
      light.position.set(0, 0.5, 0); // slightly above base
      light.castShadow = true;
      group.add(light);
    }

    this.scene.add(group);

    const key = `${assetId}_${this.positionKey(position)}`;
    group.userData = { assetId, key };
    this.placedStructures.set(key, group);

    return group;
  }

  /**
   * Place a default set of world decorations.
   * Uses a baseline terrain height of 25 — main.ts can reposition
   * structures once actual terrain heights are known.
   */
  async placeWorldDecorations(): Promise<void> {
    const DEFAULT_HEIGHT = 25;

    const decorations: Array<{
      assetId: string;
      x: number;
      yOffset: number;
      z: number;
      rotation?: THREE.Euler;
    }> = [
      { assetId: 'chest', x: 5, yOffset: 1, z: 5 },
      { assetId: 'bench', x: 10, yOffset: 1, z: 3 },
      { assetId: 'torch', x: 3, yOffset: 1, z: 3 },
      { assetId: 'bed', x: 8, yOffset: 1, z: 8 },
      { assetId: 'fox', x: 15, yOffset: 1, z: 15 },
      { assetId: 'motorcycle', x: 20, yOffset: 1, z: 0 },
      { assetId: 'diamond_sword', x: 12, yOffset: 2, z: 12 },
    ];

    const promises = decorations.map((d) =>
      this.placeAsset(
        d.assetId,
        new THREE.Vector3(d.x, DEFAULT_HEIGHT + d.yOffset, d.z),
        d.rotation
      )
    );

    await Promise.all(promises);
  }

  /**
   * Remove a placed asset from the scene and internal registry.
   *
   * @param key — the placedStructures map key
   */
  removeAsset(key: string): void {
    const group = this.placedStructures.get(key);
    if (group) {
      this.scene.remove(group);
      // Dispose geometries and materials
      group.traverse((child: THREE.Object3D) => {
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
      this.placedStructures.delete(key);
    }
  }
}
