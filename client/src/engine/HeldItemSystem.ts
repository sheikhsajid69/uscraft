import {
  Camera,
  Group,
  Mesh,
  BoxGeometry,
  MeshLambertMaterial,
  Object3D,
} from 'three';
import { BlockId, BLOCK_DEFS } from '@voxelia/shared';
import { AssetLoader } from './AssetLoader';
import { getActiveBlockId } from '../ui/inventoryStore';

export class HeldItemSystem {
  private readonly camera: Camera;
  private readonly loader: AssetLoader;
  private readonly holder: Group;

  private swordModel: Object3D | null = null;
  private gunModel: Object3D | null = null;
  private blockMesh: Mesh;
  private blockMat: MeshLambertMaterial;

  private currentBlockId: BlockId = BlockId.AIR;
  private swingTimer = 0;
  private isSwinging = false;
  private isRecoil = false;
  private recoilTimer = 0;

  constructor(camera: Camera, loader: AssetLoader) {
    this.camera = camera;
    this.loader = loader;

    this.holder = new Group();
    // Position held item in bottom-right view of camera
    this.holder.position.set(0.35, -0.28, -0.5);
    this.camera.add(this.holder);

    this.blockMat = new MeshLambertMaterial({ color: 0x888888 });
    this.blockMesh = new Mesh(new BoxGeometry(0.18, 0.18, 0.18), this.blockMat);
    this.blockMesh.visible = false;
    this.holder.add(this.blockMesh);

    this.initModels();
  }

  private async initModels(): Promise<void> {
    try {
      this.swordModel = await this.loader.loadModel('/assets/models/minecraft_diamond-sword.glb');
      this.swordModel.scale.setScalar(0.35);
      this.swordModel.rotation.set(0, Math.PI / 2, -Math.PI / 4);
      this.swordModel.visible = false;
      this.holder.add(this.swordModel);
    } catch (e) {
      console.warn('[HeldItemSystem] Failed to load sword model:', e);
    }

    try {
      this.gunModel = await this.loader.loadModel('/assets/models/minecraft_matchlock.glb');
      this.gunModel.scale.setScalar(0.4);
      this.gunModel.rotation.set(0, Math.PI, 0);
      this.gunModel.visible = false;
      this.holder.add(this.gunModel);
    } catch (e) {
      console.warn('[HeldItemSystem] Failed to load matchlock model:', e);
    }
  }

  public triggerSwing(): void {
    this.isSwinging = true;
    this.swingTimer = 0.25;
  }

  public triggerRecoil(): void {
    this.isRecoil = true;
    this.recoilTimer = 0.18;
  }

  public update(dt: number, isMoving: boolean, isSprinting: boolean): void {
    const activeId = getActiveBlockId();

    if (activeId !== this.currentBlockId) {
      this.currentBlockId = activeId;
      this.updateActiveModel(activeId);
    }

    // Default rest position & rotation
    let restX = 0.35;
    let restY = -0.28;
    let restZ = -0.5;
    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;

    // Movement bobbing
    if (isMoving) {
      const freq = isSprinting ? 14 : 9;
      const amp = isSprinting ? 0.03 : 0.015;
      const time = performance.now() * 0.001 * freq;
      restY += Math.sin(time) * amp;
      restX += Math.cos(time * 0.5) * (amp * 0.8);
    }

    // Swing animation
    if (this.isSwinging) {
      this.swingTimer -= dt;
      if (this.swingTimer <= 0) {
        this.isSwinging = false;
        this.swingTimer = 0;
      } else {
        const progress = 1.0 - this.swingTimer / 0.25;
        const swingArc = Math.sin(progress * Math.PI);
        rotX += swingArc * 0.8;
        rotY -= swingArc * 0.5;
        restZ -= swingArc * 0.12;
      }
    }

    // Gun recoil animation
    if (this.isRecoil) {
      this.recoilTimer -= dt;
      if (this.recoilTimer <= 0) {
        this.isRecoil = false;
        this.recoilTimer = 0;
      } else {
        const progress = 1.0 - this.recoilTimer / 0.18;
        const kick = Math.sin(progress * Math.PI);
        restZ += kick * 0.15;
        rotX -= kick * 0.4;
      }
    }

    this.holder.position.set(restX, restY, restZ);
    this.holder.rotation.set(rotX, rotY, rotZ);
  }

  private updateActiveModel(blockId: BlockId): void {
    if (this.swordModel) this.swordModel.visible = false;
    if (this.gunModel) this.gunModel.visible = false;
    this.blockMesh.visible = false;

    if (blockId === BlockId.SWORD) {
      if (this.swordModel) this.swordModel.visible = true;
    } else if (blockId === BlockId.MATCHLOCK) {
      if (this.gunModel) this.gunModel.visible = true;
    } else if (blockId !== BlockId.AIR) {
      const def = BLOCK_DEFS[blockId];
      if (def) {
        this.blockMat.color.setHex(def.color);
        this.blockMesh.visible = true;
      }
    }
  }

  public dispose(): void {
    this.camera.remove(this.holder);
    this.blockMesh.geometry.dispose();
    this.blockMat.dispose();
  }
}
