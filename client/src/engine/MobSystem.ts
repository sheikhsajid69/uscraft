import { Scene, Vector3, Object3D, Mesh, MeshBasicMaterial, BoxGeometry } from 'three';
import { BlockId, CHUNK_HEIGHT } from '@voxelia/shared';
import type { ChunkManager } from './ChunkManager';
import { queryTerrainHeight } from './ChunkManager';
import type { PlayerController } from './PlayerController';
import { AssetLoader } from './AssetLoader';
import { audio } from './AudioSystem';

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
}

export class MobSystem {
  private readonly mobs = new Map<string, MobEntity>();
  private readonly scene: Scene;
  private readonly chunks: ChunkManager;
  private readonly player: PlayerController;
  private readonly loader = new AssetLoader();
  private spawnTimer = 0;
  private nextId = 1;

  constructor(scene: Scene, chunks: ChunkManager, player: PlayerController) {
    this.scene = scene;
    this.chunks = chunks;
    this.player = player;
  }

  public async spawnMob(type: MobType, wx: number, wy: number, wz: number): Promise<MobEntity | null> {
    let url = '';
    let scale = 1.0;
    let flying = false;
    let speed = 3.0;

    if (type === 'fox') {
      url = '/assets/models/fox_minecraft.glb';
      scale = 0.5;
      speed = 3.8;
    } else if (type === 'enderman') {
      url = '/assets/models/enderman_minecraft_sonic_racing_crossworlds.glb';
      scale = 1.2;
      speed = 3.5;
    } else if (type === 'ghast') {
      url = '/assets/models/ghast_minecraft_sonic_racing_crossworlds.glb';
      scale = 1.5;
      speed = 2.5;
      flying = true;
    } else if (type === 'warden') {
      url = '/assets/models/minecraft_warden.glb';
      scale = 1.1;
      speed = 2.2;
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

    for (const mob of this.mobs.values()) {
      mob.stateTimer -= dt;

      // Distance to player
      const distToPlayer = mob.position.distanceTo(playerPos);

      // State Transitions
      if (mob.state === 'idle' && mob.stateTimer <= 0) {
        mob.state = 'roam';
        mob.stateTimer = 4 + Math.random() * 3;
        // Pick random roam target
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
      if (distToPlayer < 10) {
        if (mob.type === 'warden' || (mob.type === 'enderman' && isNight)) {
          mob.state = 'chase';
          mob.targetPos = playerPos.clone();
        } else if (mob.type === 'fox') {
          mob.state = 'flee';
          const awayDir = mob.position.clone().sub(playerPos).normalize();
          mob.targetPos = mob.position.clone().addScaledVector(awayDir, 6);
        }
      } else if (mob.state === 'chase' || mob.state === 'flee') {
        if (distToPlayer > 15) {
          mob.state = 'idle';
          mob.targetPos = null;
        }
      }

      // Movement execution
      if (mob.targetPos) {
        const moveDir = mob.targetPos.clone().sub(mob.position);
        if (!mob.flying) moveDir.y = 0; // horizontal only for ground mobs
        const dist = moveDir.length();

        if (dist > 0.5) {
          moveDir.normalize();
          mob.position.addScaledVector(moveDir, mob.speed * dt);

          // Rotate model to face move direction
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

      // Idle breathing / bobbing
      mob.model.position.copy(mob.position);
      if (mob.flying) {
        mob.model.position.y += Math.sin(performance.now() * 0.003 + mob.id.length) * 0.3;
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
  }
}
