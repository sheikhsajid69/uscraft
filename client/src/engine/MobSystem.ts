import {
  Scene,
  Vector3,
  Object3D,
  Mesh,
  MeshBasicMaterial,
  BoxGeometry,
  SphereGeometry,
} from 'three';
import { BlockId, CHUNK_HEIGHT } from '@voxelia/shared';
import type { ChunkManager } from './ChunkManager';
import { queryTerrainHeight } from './ChunkManager';
import type { PlayerController } from './PlayerController';
import { AssetLoader } from './AssetLoader';
import { audio } from './AudioSystem';
import type { ParticleSystem } from './ParticleSystem';
import { damagePlayer } from '../ui/stats';
import { inventoryState } from '../ui/inventoryStore';

export type MobType = 'fox' | 'enderman' | 'ghast' | 'warden';

export interface MobEntity {
  id: string;
  type: MobType;
  model: Object3D;
  position: Vector3;
  targetPos: Vector3 | null;
  speed: number;
  flying: boolean;
  state: 'idle' | 'roam' | 'chase' | 'flee';
  stateTimer: number;
  health: number;
  maxHealth: number;
  hitFlashTimer: number;
  attackCooldown: number;
}

export interface MobProjectile {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  life: number;
}

export class MobSystem {
  private readonly mobs = new Map<string, MobEntity>();
  private readonly projectiles: MobProjectile[] = [];
  private readonly scene: Scene;
  private readonly chunks: ChunkManager;
  private readonly player: PlayerController;
  private readonly particles?: ParticleSystem;
  private readonly loader = new AssetLoader();
  private spawnTimer = 0;
  private nextId = 1;

  constructor(
    scene: Scene,
    chunks: ChunkManager,
    player: PlayerController,
    particles?: ParticleSystem
  ) {
    this.scene = scene;
    this.chunks = chunks;
    this.player = player;
    this.particles = particles;
  }

  public async spawnMob(type: MobType, wx: number, wy: number, wz: number): Promise<MobEntity | null> {
    let url = '';
    let scale = 1.0;
    let flying = false;
    let speed = 3.0;
    let maxHealth = 20;

    if (type === 'fox') {
      url = '/assets/models/fox_minecraft.glb';
      scale = 0.5;
      speed = 3.8;
      maxHealth = 10;
    } else if (type === 'enderman') {
      url = '/assets/models/enderman_minecraft_sonic_racing_crossworlds.glb';
      scale = 1.2;
      speed = 3.5;
      maxHealth = 40;
    } else if (type === 'ghast') {
      url = '/assets/models/ghast_minecraft_sonic_racing_crossworlds.glb';
      scale = 1.5;
      speed = 2.5;
      flying = true;
      maxHealth = 20;
    } else if (type === 'warden') {
      url = '/assets/models/minecraft_warden.glb';
      scale = 1.1;
      speed = 2.2;
      maxHealth = 100;
    }

    let model: Object3D;
    try {
      model = await this.loader.loadModel(url);
    } catch (e) {
      console.warn(`[MobSystem] Failed to load GLB for ${type}, using fallback cube:`, e);
      const mat = new MeshBasicMaterial({ color: type === 'fox' ? 0xd06030 : 0x401060 });
      model = new Mesh(new BoxGeometry(0.8, 1.2, 0.8), mat);
    }

    model.scale.setScalar(scale);
    model.position.set(wx, wy, wz);
    model.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(model);

    const mob: MobEntity = {
      id: `mob_${this.nextId++}`,
      type,
      model,
      position: new Vector3(wx, wy, wz),
      targetPos: null,
      speed,
      flying,
      state: 'idle',
      stateTimer: 2 + Math.random() * 2,
      health: maxHealth,
      maxHealth,
      hitFlashTimer: 0,
      attackCooldown: 1.0,
    };

    this.mobs.set(mob.id, mob);
    audio.playMobGrowl();
    return mob;
  }

  public update(dt: number, isNight: boolean): void {
    this.spawnTimer += dt;
    if (this.mobs.size < 8 && this.spawnTimer > 4.0) {
      this.spawnTimer = 0;
      this.trySpawnRandomMob(isNight);
    }

    const playerPos = this.player.getPosition();

    // ── Update Mobs ────────────────────────────────────────────────────────
    for (const [id, mob] of this.mobs) {
      mob.stateTimer -= dt;
      mob.attackCooldown -= dt;

      // Handle damage hit-flash visual
      if (mob.hitFlashTimer > 0) {
        mob.hitFlashTimer -= dt;
        if (mob.hitFlashTimer <= 0) {
          mob.model.traverse((child) => {
            if (child instanceof Mesh && child.material && 'color' in child.material) {
              child.material.color.setHex(0xffffff);
            }
          });
        }
      }

      // Distance to player
      const distToPlayer = mob.position.distanceTo(playerPos);

      // State Transitions
      if (mob.state === 'idle' && mob.stateTimer <= 0) {
        mob.state = 'roam';
        mob.stateTimer = 4 + Math.random() * 3;
        const angle = Math.random() * Math.PI * 2;
        const dist = 4 + Math.random() * 8;
        const tx = mob.position.x + Math.cos(angle) * dist;
        const tz = mob.position.z + Math.sin(angle) * dist;
        const ty = mob.flying ? mob.position.y + (Math.random() - 0.5) * 4 : this.findGroundY(tx, tz);
        mob.targetPos = new Vector3(tx, ty, tz);
      } else if (mob.state === 'roam' && mob.stateTimer <= 0) {
        mob.state = 'idle';
        mob.stateTimer = 2 + Math.random() * 3;
        mob.targetPos = null;
      }

      // Check hostility / reaction to player
      if (distToPlayer < 12) {
        if (mob.type === 'warden' || (mob.type === 'enderman' && (isNight || mob.health < mob.maxHealth))) {
          mob.state = 'chase';
          mob.targetPos = playerPos.clone();

          // Melee attack player if close
          if (distToPlayer < 2.0 && mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.2;
            damagePlayer(mob.type === 'warden' ? 8 : 4);
            audio.playHit();
          }
        } else if (mob.type === 'ghast') {
          mob.state = 'chase';
          mob.targetPos = new Vector3(playerPos.x, playerPos.y + 8, playerPos.z);

          // Ghast fires fireball
          if (distToPlayer < 25 && mob.attackCooldown <= 0) {
            mob.attackCooldown = 3.5;
            this.spawnGhastFireball(mob.position, playerPos);
          }
        } else if (mob.type === 'fox') {
          mob.state = 'flee';
          const awayDir = mob.position.clone().sub(playerPos).normalize();
          mob.targetPos = mob.position.clone().addScaledVector(awayDir, 6);
        }
      } else if (mob.state === 'chase' || mob.state === 'flee') {
        if (distToPlayer > 18) {
          mob.state = 'idle';
          mob.targetPos = null;
        }
      }

      // Movement execution
      if (mob.targetPos) {
        const moveDir = mob.targetPos.clone().sub(mob.position);
        if (!mob.flying) moveDir.y = 0;
        const dist = moveDir.length();

        if (dist > 0.5) {
          moveDir.normalize();
          mob.position.addScaledVector(moveDir, mob.speed * dt);

          const targetYaw = Math.atan2(moveDir.x, moveDir.z);
          let diff = targetYaw - mob.model.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          mob.model.rotation.y += diff * Math.min(1, dt * 10);
        } else if (mob.state === 'roam') {
          mob.state = 'idle';
          mob.targetPos = null;
        }
      }

      // Ground clamping for non-flying mobs
      if (!mob.flying) {
        const groundY = this.findGroundY(mob.position.x, mob.position.z);
        mob.position.y += (groundY - mob.position.y) * Math.min(1, dt * 10);
      }

      mob.model.position.copy(mob.position);
      if (mob.flying) {
        mob.model.position.y += Math.sin(performance.now() * 0.003 + mob.id.length) * 0.3;
      }
    }

    // ── Update Projectiles ──────────────────────────────────────────────────
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);

      // Check hit with player
      if (p.position.distanceTo(playerPos) < 1.5) {
        damagePlayer(5);
        audio.playBlockBreak();
        this.particles?.spawnBlockBreakParticles(p.position, 0xff4400);
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }

      // Expire
      if (p.life <= 0) {
        this.particles?.spawnBlockBreakParticles(p.position, 0x888888);
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private spawnGhastFireball(from: Vector3, to: Vector3): void {
    const dir = to.clone().sub(from).normalize();
    const geom = new SphereGeometry(0.35, 8, 8);
    const mat = new MeshBasicMaterial({ color: 0xff3300 });
    const mesh = new Mesh(geom, mat);
    mesh.position.copy(from);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      position: from.clone(),
      velocity: dir.multiplyScalar(10),
      life: 5.0,
    });
    audio.playMobGrowl();
  }

  /**
   * Raycasts against active mobs to detect weapon / melee attacks.
   */
  public raycastMob(
    origin: Vector3,
    direction: Vector3,
    maxDistance = 5.0
  ): { mob: MobEntity; point: Vector3 } | null {
    let closestDist = maxDistance;
    let closestMob: MobEntity | null = null;
    let hitPoint = new Vector3();

    for (const mob of this.mobs.values()) {
      const mobPos = mob.position.clone();
      mobPos.y += mob.flying ? 0 : 0.8; // Center of mass
      const toMob = mobPos.clone().sub(origin);
      const proj = toMob.dot(direction);

      if (proj > 0 && proj < closestDist) {
        const perpDist = toMob.clone().sub(direction.clone().multiplyScalar(proj)).length();
        const hitboxRadius = mob.type === 'warden' ? 1.4 : mob.type === 'ghast' ? 1.8 : 0.9;
        if (perpDist <= hitboxRadius) {
          closestDist = proj;
          closestMob = mob;
          hitPoint = origin.clone().addScaledVector(direction, proj);
        }
      }
    }

    return closestMob ? { mob: closestMob, point: hitPoint } : null;
  }

  /**
   * Applies damage, hit flash, knockback, and death loot drops to a mob.
   */
  public damageMob(mobId: string, amount: number, knockbackDir?: Vector3): void {
    const mob = this.mobs.get(mobId);
    if (!mob) return;

    mob.health -= amount;
    mob.hitFlashTimer = 0.25;

    // Red tint on materials
    mob.model.traverse((child) => {
      if (child instanceof Mesh && child.material && 'color' in child.material) {
        child.material.color.setHex(0xff3333);
      }
    });

    // Knockback
    if (knockbackDir) {
      mob.position.addScaledVector(knockbackDir.normalize(), 1.2);
    }

    audio.playHit();
    this.particles?.spawnBlockBreakParticles(mob.position, 0xcc0000);

    // Enderman teleport evasion on damage
    if (mob.type === 'enderman' && mob.health > 0) {
      const angle = Math.random() * Math.PI * 2;
      mob.position.x += Math.cos(angle) * 8;
      mob.position.z += Math.sin(angle) * 8;
      mob.position.y = this.findGroundY(mob.position.x, mob.position.z);
      this.particles?.spawnBlockBreakParticles(mob.position, 0x8800cc);
    }

    // Mob Death
    if (mob.health <= 0) {
      this.scene.remove(mob.model);
      this.mobs.delete(mobId);
      this.particles?.spawnBlockBreakParticles(mob.position, 0xffaa00);

      // Reward loot drop directly into hotbar
      const lootBlockId =
        mob.type === 'fox'
          ? BlockId.WOOD
          : mob.type === 'enderman'
          ? BlockId.GLASS
          : mob.type === 'ghast'
          ? BlockId.TORCH_BLOCK
          : BlockId.STONE;

      for (let i = 0; i < 9; i++) {
        const slot = inventoryState.hotbar[i];
        if (slot && slot.blockId === lootBlockId && slot.count < 64) {
          slot.count += 2;
          break;
        } else if (!slot) {
          inventoryState.hotbar[i] = { blockId: lootBlockId, count: 2 };
          break;
        }
      }
    }
  }

  private trySpawnRandomMob(isNight: boolean): void {
    const playerPos = this.player.getPosition();
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 15;
    const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);
    const wy = this.findGroundY(wx, wz);

    let type: MobType = 'fox';
    if (wy < 28) {
      type = 'warden';
    } else if (isNight) {
      type = Math.random() > 0.5 ? 'enderman' : 'ghast';
    } else {
      type = 'fox';
    }

    const spawnY = type === 'ghast' ? wy + 12 : wy;
    this.spawnMob(type, wx, spawnY, wz);
  }

  private findGroundY(wx: number, wz: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const block = this.chunks.getBlock(wx, y, wz);
      if (block !== BlockId.AIR && block !== BlockId.WATER) {
        return y + 1;
      }
    }
    return queryTerrainHeight(wx, wz) + 1;
  }

  public dispose(): void {
    for (const mob of this.mobs.values()) {
      this.scene.remove(mob.model);
    }
    this.mobs.clear();
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    this.projectiles.length = 0;
  }
}
