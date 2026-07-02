import {
  Scene,
  Vector3,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  LineSegments,
  WireframeGeometry,
} from 'three';
import { BlockId, BLOCK_DEFS, CHUNK_HEIGHT } from '@voxelia/shared';
import type { ChunkManager } from './ChunkManager';
import type { PlayerController } from './PlayerController';
import type { AudioSystem } from './AudioSystem';
import type { ParticleSystem } from './ParticleSystem';
import type { NetworkClient } from './NetworkClient';
import type { InputController } from './InputController';
import { getActiveBlockId, consumeActiveItem, inventoryState } from '../ui/inventoryStore';

export interface RaycastHit {
  readonly wx: number;
  readonly wy: number;
  readonly wz: number;
  readonly blockId: BlockId;
  readonly normal: Vector3;
}

export class BlockInteraction {
  public currentHit: RaycastHit | null = null;
  private readonly wireframeBox: LineSegments;
  private network: NetworkClient | undefined;

  private readonly scene: Scene;
  private readonly chunks: ChunkManager;
  private readonly player: PlayerController;
  private readonly input: InputController;
  private readonly audio: AudioSystem;
  private readonly particles: ParticleSystem;

  private onMouseDown = (e: MouseEvent) => this.handleMouseDown(e);
  private onContextMenu = (e: Event) => e.preventDefault();

  constructor(
    scene: Scene,
    chunks: ChunkManager,
    player: PlayerController,
    input: InputController,
    audio: AudioSystem,
    particles: ParticleSystem,
    network?: NetworkClient
  ) {
    this.scene = scene;
    this.chunks = chunks;
    this.player = player;
    this.input = input;
    this.audio = audio;
    this.particles = particles;
    this.network = network;

    const wireGeom = new WireframeGeometry(new BoxGeometry(1.01, 1.01, 1.01));
    const wireMat = new MeshBasicMaterial({ color: 0x000000, wireframe: true });
    this.wireframeBox = new LineSegments(wireGeom, wireMat);
    this.wireframeBox.visible = false;
    this.scene.add(this.wireframeBox);

    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('contextmenu', this.onContextMenu);
  }

  public setNetworkClient(net: NetworkClient): void {
    this.network = net;
  }

  public update(dt: number): void {
    if (!this.input.isPointerLocked() || inventoryState.isOpen) {
      this.currentHit = null;
      this.wireframeBox.visible = false;
      return;
    }

    this.currentHit = this.raycast(5.0);
    if (this.currentHit) {
      this.wireframeBox.position.set(
        this.currentHit.wx + 0.5,
        this.currentHit.wy + 0.5,
        this.currentHit.wz + 0.5
      );
      this.wireframeBox.visible = true;
    } else {
      this.wireframeBox.visible = false;
    }
  }

  private raycast(maxDistance: number): RaycastHit | null {
    const origin = this.player.getPosition();
    const direction = this.player.getLookVector();

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);

    const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

    let tMaxX =
      direction.x > 0 ? (Math.floor(origin.x) + 1 - origin.x) * tDeltaX : (origin.x - Math.floor(origin.x)) * tDeltaX;
    let tMaxY =
      direction.y > 0 ? (Math.floor(origin.y) + 1 - origin.y) * tDeltaY : (origin.y - Math.floor(origin.y)) * tDeltaY;
    let tMaxZ =
      direction.z > 0 ? (Math.floor(origin.z) + 1 - origin.z) * tDeltaZ : (origin.z - Math.floor(origin.z)) * tDeltaZ;

    let normal = new Vector3();
    let distance = 0;

    while (distance < maxDistance) {
      const blockId = this.chunks.getBlock(x, y, z);
      if (blockId !== BlockId.AIR && blockId !== BlockId.WATER) {
        return {
          wx: x,
          wy: y,
          wz: z,
          blockId,
          normal: normal.clone(),
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          distance = tMaxX;
          tMaxX += tDeltaX;
          normal.set(-stepX, 0, 0);
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;
          normal.set(0, 0, -stepZ);
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          distance = tMaxY;
          tMaxY += tDeltaY;
          normal.set(0, -stepY, 0);
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;
          normal.set(0, 0, -stepZ);
        }
      }
    }

    return null;
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.input.isPointerLocked() || inventoryState.isOpen || !this.currentHit) return;

    if (e.button === 0) {
      // Left click: Break block
      const { wx, wy, wz, blockId } = this.currentHit;
      const def = BLOCK_DEFS[blockId];
      if (def && def.breakable === false) return;

      const color = def ? def.color : 0x888888;
      this.particles.spawnBlockBreakParticles(new Vector3(wx + 0.5, wy + 0.5, wz + 0.5), color);
      this.audio.playBlockBreak();
      this.chunks.setBlock(wx, wy, wz, BlockId.AIR);
      this.network?.sendBlockEdit(wx, wy, wz, BlockId.AIR);
      this.currentHit = null;
      this.wireframeBox.visible = false;
    } else if (e.button === 2) {
      // Right click: Place block
      const activeBlockId = getActiveBlockId();
      if (activeBlockId === BlockId.AIR) return;

      const { wx, wy, wz, normal } = this.currentHit;
      const px = wx + normal.x;
      const py = wy + normal.y;
      const pz = wz + normal.z;

      if (py < 0 || py >= CHUNK_HEIGHT) return;

      // Check collision with player bounding box
      const playerPos = this.player.getPosition();
      const dx = px + 0.5 - playerPos.x;
      const dz = pz + 0.5 - playerPos.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);
      const verticalOverlap = py + 1 > playerPos.y - 1.6 && py < playerPos.y + 0.2;

      if (horizontalDist < 0.7 && verticalOverlap) {
        return; // Cannot place block inside player
      }

      const def = BLOCK_DEFS[activeBlockId];
      const color = def ? def.color : 0x888888;
      this.audio.playBlockPlace();
      this.particles.spawnBlockPlaceParticles(new Vector3(px + 0.5, py + 0.5, pz + 0.5), color);
      this.chunks.setBlock(px, py, pz, activeBlockId);
      this.network?.sendBlockEdit(px, py, pz, activeBlockId);
      consumeActiveItem();
    }
  }

  public dispose(): void {
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('contextmenu', this.onContextMenu);
    this.scene.remove(this.wireframeBox);
    this.wireframeBox.geometry.dispose();
  }
}
