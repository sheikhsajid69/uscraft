import * as THREE from 'three';

export class Projectile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  active: boolean = true;
  life: number = 0;
  maxLife: number = 5.0; // 5 seconds
  radius: number;

  constructor(scene: THREE.Scene, startPos: THREE.Vector3, velocity: THREE.Vector3, radius: number = 0.2) {
    this.position = startPos.clone();
    this.velocity = velocity.clone();
    this.radius = radius;
    
    const geometry = new THREE.SphereGeometry(radius, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  update(dt: number, scene: THREE.Scene): void {
    if (!this.active) return;

    this.life += dt;
    if (this.life > this.maxLife) {
      this.destroy(scene);
      return;
    }

    // Parabolic physics (gravity)
    this.velocity.y -= 20 * dt; // Gravity
    this.position.addScaledVector(this.velocity, dt);
    this.mesh.position.copy(this.position);

    // TODO: Collision detection with chunks can go here.
    // We would use raycastBlocks or a simple AABB/Box3 intersection.
  }

  destroy(scene: THREE.Scene): void {
    this.active = false;
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export class ProjectileManager {
  private projectiles: Projectile[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawn(startPos: THREE.Vector3, velocity: THREE.Vector3): void {
    const proj = new Projectile(this.scene, startPos, velocity);
    this.projectiles.push(proj);
  }

  update(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, this.scene);
      if (!p.active) {
        this.projectiles.splice(i, 1);
      }
    }
  }
}
