import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Singleton GLB asset loader with caching and deduplication.
 * Prevents duplicate network requests and enables progress tracking.
 */
export class AssetLoader {
  private static instance: AssetLoader;
  private loader: GLTFLoader;
  private cache: Map<string, GLTF>;
  private loading: Map<string, Promise<GLTF>>;

  private constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.loading = new Map();
  }

  static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  /**
   * Prepares a cloned scene group with shadows enabled on all meshes.
   */
  private prepareClone(gltf: GLTF): THREE.Group {
    const clone = gltf.scene.clone();
    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }

  /**
   * Load a GLB file from /models/ directory.
   * Returns a cloned scene group with shadows enabled.
   * Uses cache to avoid duplicate loads.
   */
  async load(filename: string): Promise<THREE.Group> {
    // Return from cache immediately
    if (this.cache.has(filename)) {
      return this.prepareClone(this.cache.get(filename)!);
    }

    // If already loading, wait for the existing promise
    if (this.loading.has(filename)) {
      const gltf = await this.loading.get(filename)!;
      return this.prepareClone(gltf);
    }

    // Start a new load
    const loadPromise = new Promise<GLTF>((resolve, reject) => {
      this.loader.load(
        `/models/${filename}`,
        (gltf: GLTF) => {
          this.cache.set(filename, gltf);
          this.loading.delete(filename);
          resolve(gltf);
        },
        undefined,
        (error: any) => {
          this.loading.delete(filename);
          reject(new Error(`Failed to load asset: ${filename} — ${error}`));
        }
      );
    });

    this.loading.set(filename, loadPromise);
    const gltf = await loadPromise;
    return this.prepareClone(gltf);
  }

  /**
   * Load a GLB file with progress callback.
   * Progress is reported as a percentage (0–100).
   */
  async loadWithProgress(
    filename: string,
    onProgress?: (percent: number) => void
  ): Promise<THREE.Group> {
    // Return from cache immediately
    if (this.cache.has(filename)) {
      onProgress?.(100);
      return this.prepareClone(this.cache.get(filename)!);
    }

    // If already loading, wait for the existing promise (no progress for deduped)
    if (this.loading.has(filename)) {
      const gltf = await this.loading.get(filename)!;
      onProgress?.(100);
      return this.prepareClone(gltf);
    }

    const loadPromise = new Promise<GLTF>((resolve, reject) => {
      this.loader.load(
        `/models/${filename}`,
        (gltf: GLTF) => {
          this.cache.set(filename, gltf);
          this.loading.delete(filename);
          onProgress?.(100);
          resolve(gltf);
        },
        (event: ProgressEvent) => {
          if (event.lengthComputable && onProgress) {
            const percent = (event.loaded / event.total) * 100;
            onProgress(Math.min(percent, 99));
          }
        },
        (error: any) => {
          this.loading.delete(filename);
          reject(new Error(`Failed to load asset: ${filename} — ${error}`));
        }
      );
    });

    this.loading.set(filename, loadPromise);
    const gltf = await loadPromise;
    return this.prepareClone(gltf);
  }

  /**
   * Preload multiple assets in parallel.
   */
  async preloadAll(filenames: string[]): Promise<void> {
    await Promise.all(filenames.map((f) => this.load(f)));
  }
}
