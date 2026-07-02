import { Scene, Vector3, Mesh, BoxGeometry, MeshLambertMaterial, Object3D, Color } from 'three';

export interface Particle {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  maxLife: number;
  active: boolean;
  initialScale?: number;
}

/**
 * High-performance Three.js particle system for block breaking and placing debris.
 * Uses a fixed object pool of mini cube meshes to ensure zero memory churn during gameplay.
 */
export class ParticleSystem {
  private readonly scene: Scene;
  private readonly pool: Particle[] = [];
  private readonly geometry: BoxGeometry;
  private static readonly POOL_SIZE = 64;

  constructor(scene: Scene) {
    this.scene = scene;
    this.geometry = new BoxGeometry(0.18, 0.18, 0.18);

    for (let i = 0; i < ParticleSystem.POOL_SIZE; i++) {
      const material = new MeshLambertMaterial();
      const mesh = new Mesh(this.geometry, material);
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.scene.add(mesh);

      this.pool.push({
        mesh,
        velocity: new Vector3(),
        life: 0,
        maxLife: 1.0,
        active: false,
        initialScale: 1.0,
      });
    }
  }

  /**
   * Spawns 12 to 16 active particles centered at worldPos (offset to roughly block center +0.5, +0.5, +0.5).
   */
  public spawnBlockBreakParticles(worldPos: Vector3, blockColorHex: number): void {
    const count = 12 + Math.floor(Math.random() * 5); // 12 to 16 particles
    const centerX = worldPos.x + 0.5;
    const centerY = worldPos.y + 0.5;
    const centerZ = worldPos.z + 0.5;

    for (let i = 0; i < count; i++) {
      const p = this.getNextParticle();
      if (!p) continue;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.2; // 0.4 to 0.6 seconds
      p.initialScale = 1.0;

      // Position centered at worldPos + offset, with small random jitter around block center
      p.mesh.position.set(
        centerX + (Math.random() - 0.5) * 0.5,
        centerY + (Math.random() - 0.5) * 0.5,
        centerZ + (Math.random() - 0.5) * 0.5,
      );

      // Random outward velocities: horizontal speed -2 to +2 m/s, vertical speed +1 to +4 m/s
      p.velocity.set(
        (Math.random() - 0.5) * 4.0,
        1.0 + Math.random() * 3.0,
        (Math.random() - 0.5) * 4.0,
      );

      // Set particle material color with slightly randomized brightness ±15%
      this.applyColorWithVariation(p.mesh, blockColorHex);

      p.mesh.scale.setScalar(1.0);
      p.mesh.visible = true;

      // Random initial rotation
      p.mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
    }
  }

  /**
   * Spawns 6 to 8 smaller/simpler particles around the block faces with short life (~0.25s) and gentle outward velocities.
   */
  public spawnBlockPlaceParticles(worldPos: Vector3, blockColorHex: number): void {
    const count = 6 + Math.floor(Math.random() * 3); // 6 to 8 particles
    const centerX = worldPos.x + 0.5;
    const centerY = worldPos.y + 0.5;
    const centerZ = worldPos.z + 0.5;

    for (let i = 0; i < count; i++) {
      const p = this.getNextParticle();
      if (!p) continue;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.2 + Math.random() * 0.1; // ~0.25s
      const scale = 0.65; // smaller particles
      p.initialScale = scale;

      // Position around the block faces
      p.mesh.position.set(
        centerX + (Math.random() - 0.5) * 0.9,
        centerY + (Math.random() - 0.5) * 0.9,
        centerZ + (Math.random() - 0.5) * 0.9,
      );

      // Gentle outward velocities
      p.velocity.set(
        (Math.random() - 0.5) * 2.0, // -1 to +1 m/s
        0.5 + Math.random() * 1.5,   // +0.5 to +2.0 m/s
        (Math.random() - 0.5) * 2.0, // -1 to +1 m/s
      );

      this.applyColorWithVariation(p.mesh, blockColorHex);

      p.mesh.scale.setScalar(scale);
      p.mesh.visible = true;

      p.mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
    }
  }

  /**
   * Updates all active particles in the pool: applies gravity, velocity, rotation, and scaling.
   */
  public update(dt: number): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      // Apply gravity
      p.velocity.y -= 18 * dt;

      // Update mesh position
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Rotate mesh slightly for realistic tumbling
      p.mesh.rotation.x += 10 * dt;
      p.mesh.rotation.y += 12 * dt;

      // Advance life
      p.life += dt;

      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        p.mesh.scale.setScalar(1.0);
        p.velocity.set(0, 0, 0);
      } else {
        const progress = p.life / p.maxLife;
        if (progress > 0.7) {
          const baseScale = p.initialScale ?? 1.0;
          const scaleFactor = 1.0 - (progress - 0.7) / 0.3;
          p.mesh.scale.setScalar(Math.max(0, baseScale * scaleFactor));
        }
      }
    }
  }

  /**
   * Disposes all pooled meshes, materials, and geometry to prevent memory leaks.
   */
  public dispose(): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      this.removeMeshFromScene(p.mesh);
      if (Array.isArray(p.mesh.material)) {
        for (const mat of p.mesh.material) {
          mat.dispose();
        }
      } else {
        p.mesh.material.dispose();
      }
    }
    this.geometry.dispose();
    this.pool.length = 0;
  }

  /**
   * Helper to remove a mesh or Object3D from the scene.
   */
  private removeMeshFromScene(mesh: Object3D): void {
    this.scene.remove(mesh);
  }

  /**
   * Helper to retrieve an inactive particle from the pool, or recycle the oldest active one if full.
   */
  private getNextParticle(): Particle | null {
    // First try to find an inactive particle
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        return this.pool[i];
      }
    }

    // If pool is full, recycle the oldest active particle
    let oldest: Particle | null = null;
    let maxRatio = -1;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      const ratio = p.maxLife > 0 ? p.life / p.maxLife : 0;
      if (ratio > maxRatio) {
        maxRatio = ratio;
        oldest = p;
      }
    }
    return oldest;
  }

  /**
   * Sets the particle material color and applies a ±15% randomized brightness variation.
   */
  private applyColorWithVariation(mesh: Mesh, blockColorHex: number): void {
    const material = mesh.material as MeshLambertMaterial;
    const color: Color = material.color;
    color.setHex(blockColorHex);

    // Random brightness between 0.85 and 1.15 (±15%)
    const brightness = 0.85 + Math.random() * 0.3;
    color.r = Math.min(1.0, color.r * brightness);
    color.g = Math.min(1.0, color.g * brightness);
    color.b = Math.min(1.0, color.b * brightness);
  }
}
