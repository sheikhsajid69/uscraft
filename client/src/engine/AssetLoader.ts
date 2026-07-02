import { Group, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Result from loading the anchor terrain model. */
export interface AnchorLoadResult {
  model: Group;
  /** World-space bounding box of the loaded model. */
  bbox: Box3;
  /** Lowest Y coordinate of the model geometry. */
  baseY: number;
}

/**
 * Loads, caches, and clones GLB models.
 * All models are expected under `/assets/models/`.
 */
export class AssetLoader {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Group>();

  /**
   * Load a GLB model by filename. Returns the cached scene group on
   * subsequent calls for the same file.
   */
  public async loadModel(filename: string): Promise<Group> {
    const cleanName = filename.replace(/^\/assets\/models\//, '').replace(/^assets\/models\//, '');
    const path = `/assets/models/${cleanName}`;
    const cached = this.cache.get(cleanName);
    if (cached) return cached.clone();

    const gltf = await this.loader.loadAsync(path);
    const group = gltf.scene;
    this.cache.set(cleanName, group);
    return group.clone();
  }

  /**
   * Load the anchor terrain piece and return both the model and its
   * bounding box so the chunk generator can conform voxel terrain
   * to the model's base elevation.
   */
  public async loadAnchorTerrain(): Promise<AnchorLoadResult> {
    const group = await this.loadModel('free_dirt_road_through_forest.glb');
    group.position.set(0, 0, 0);

    // Compute the world-space bounding box after positioning
    const bbox = new Box3().setFromObject(group);
    const baseY = bbox.min.y;

    console.log(
      `[AssetLoader] Anchor AABB: min(${bbox.min.x.toFixed(1)}, ${bbox.min.y.toFixed(1)}, ${bbox.min.z.toFixed(1)}) ` +
      `max(${bbox.max.x.toFixed(1)}, ${bbox.max.y.toFixed(1)}, ${bbox.max.z.toFixed(1)})`,
    );

    return { model: group, bbox, baseY };
  }
}
