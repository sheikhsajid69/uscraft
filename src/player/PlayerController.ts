import * as THREE from 'three';
import { InputManager } from '../engine/InputManager';
import { ChunkManager } from '../world/ChunkManager';
import { GRAVITY, TERMINAL_VELOCITY, PLAYER_SPEED, SPRINT_SPEED, JUMP_FORCE, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE_HEIGHT, BLOCK_BREAK_RANGE } from '../shared/constants';
import { raycastBlocks } from '../physics/Raycast';
import { BlockType } from '../shared/blocks';
import { isBlockSolid } from '../world/BlockRegistry';
import { ChestUI } from '../ui/ChestUI';
import { StructurePlacer } from '../world/StructurePlacer';

export const hotbarBlocks = [
  BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.WOOD,
  BlockType.PLANKS, BlockType.COBBLESTONE, BlockType.SAND, BlockType.GLASS, BlockType.LEAVES
];

export class PlayerController {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  camera: THREE.PerspectiveCamera;
  yaw: number = 0;
  pitch: number = 0;
  onGround: boolean = false;
  selectedSlot: number = 0;
  selectedBlockType: BlockType = BlockType.GRASS;
  
  private input: InputManager;
  private chunkManager: ChunkManager;
  private breakTargetMesh: THREE.LineSegments;
  private chestUI: ChestUI;
  private structurePlacer: StructurePlacer;

  constructor(camera: THREE.PerspectiveCamera, chunkManager: ChunkManager, chestUI: ChestUI, structurePlacer: StructurePlacer) {
    this.camera = camera;
    this.chunkManager = chunkManager;
    this.chestUI = chestUI;
    this.structurePlacer = structurePlacer;
    this.input = InputManager.getInstance();
    
    this.position = new THREE.Vector3(0, 40, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    
    const geo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const edges = new THREE.EdgesGeometry(geo);
    this.breakTargetMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
    this.chunkManager.scene.add(this.breakTargetMesh);
    this.breakTargetMesh.visible = false;
  }

  update(dt: number): void {
    if (!this.input.isPointerLocked()) {
      return;
    }
    
    const mouseDelta = this.input.getMouseDelta();
    this.yaw -= mouseDelta.x * 0.002;
    this.pitch -= mouseDelta.y * 0.002;
    const PI_2 = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-PI_2, Math.min(PI_2, this.pitch));
    
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    
    const speed = this.input.isKeyDown('ShiftLeft') ? SPRINT_SPEED : PLAYER_SPEED;
    
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    
    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.input.isKeyDown('KeyW')) moveDir.add(forward);
    if (this.input.isKeyDown('KeyS')) moveDir.sub(forward);
    if (this.input.isKeyDown('KeyD')) moveDir.add(right);
    if (this.input.isKeyDown('KeyA')) moveDir.sub(right);
    
    if (moveDir.lengthSq() > 0) moveDir.normalize();
    
    this.velocity.x = moveDir.x * speed;
    this.velocity.z = moveDir.z * speed;
    
    if (this.input.isKeyDown('Space') && this.onGround) {
      this.velocity.y = JUMP_FORCE;
      this.onGround = false;
    }
    
    this.velocity.y += GRAVITY * dt;
    this.velocity.y = Math.max(TERMINAL_VELOCITY, this.velocity.y);
    
    this.onGround = false;
    
    this.position.x += this.velocity.x * dt;
    this.resolveCollision(new THREE.Vector3(1, 0, 0));
    
    this.position.y += this.velocity.y * dt;
    this.resolveCollision(new THREE.Vector3(0, 1, 0));
    
    this.position.z += this.velocity.z * dt;
    this.resolveCollision(new THREE.Vector3(0, 0, 1));
    
    this.camera.position.set(this.position.x, this.position.y + PLAYER_EYE_HEIGHT, this.position.z);
    
    const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const hit = raycastBlocks(this.camera.position, rayDir, BLOCK_BREAK_RANGE, (x, y, z) => this.chunkManager.getBlock(x, y, z));
    
    let objectHit = false;

    // Check interaction with chest when right clicking
    if (this.input.isMouseButtonPressed(2)) { // Right click
      const raycaster = new THREE.Raycaster(this.camera.position, rayDir, 0, BLOCK_BREAK_RANGE);
      const meshes = Array.from(this.structurePlacer.placedStructures.values());
      const intersects = raycaster.intersectObjects(meshes, true);
      
      if (intersects.length > 0) {
        // Find the group root with userData
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.userData?.key) {
          obj = obj.parent;
        }
        
        if (obj && obj.userData.assetId === 'chest') {
          this.chestUI.open(obj.userData.key);
          this.input.unlockPointer();
          objectHit = true;
        }
      }
    }

    if (!objectHit && hit) {
      this.breakTargetMesh.position.copy(hit.position).addScalar(0.5);
      this.breakTargetMesh.visible = true;
      
      if (this.input.isMouseButtonPressed(0)) {
        this.chunkManager.setBlock(hit.position.x, hit.position.y, hit.position.z, BlockType.AIR);
      } else if (this.input.isMouseButtonPressed(2)) {
        const placePos = hit.position.clone().add(hit.normal);
        
        const blockAABB = new THREE.Box3(
          new THREE.Vector3(placePos.x, placePos.y, placePos.z),
          new THREE.Vector3(placePos.x + 1, placePos.y + 1, placePos.z + 1)
        );
        const playerAABB = new THREE.Box3(
          new THREE.Vector3(this.position.x - PLAYER_WIDTH/2, this.position.y, this.position.z - PLAYER_WIDTH/2),
          new THREE.Vector3(this.position.x + PLAYER_WIDTH/2, this.position.y + PLAYER_HEIGHT, this.position.z + PLAYER_WIDTH/2)
        );
        
        if (!playerAABB.intersectsBox(blockAABB)) {
          this.chunkManager.setBlock(placePos.x, placePos.y, placePos.z, this.selectedBlockType);
        }
      }
    } else {
      this.breakTargetMesh.visible = false;
    }
    
    const scroll = this.input.getScrollDelta();
    if (scroll > 0) this.selectedSlot = (this.selectedSlot + 1) % 9;
    if (scroll < 0) this.selectedSlot = (this.selectedSlot - 1 + 9) % 9;
    
    this.selectedBlockType = hotbarBlocks[this.selectedSlot];
  }
  
  private resolveCollision(axis: THREE.Vector3): void {
    const playerAABB = new THREE.Box3(
      new THREE.Vector3(this.position.x - PLAYER_WIDTH/2, this.position.y, this.position.z - PLAYER_WIDTH/2),
      new THREE.Vector3(this.position.x + PLAYER_WIDTH/2, this.position.y + PLAYER_HEIGHT, this.position.z + PLAYER_WIDTH/2)
    );
    
    const minX = Math.floor(playerAABB.min.x);
    const maxX = Math.ceil(playerAABB.max.x);
    const minY = Math.floor(playerAABB.min.y);
    const maxY = Math.ceil(playerAABB.max.y);
    const minZ = Math.floor(playerAABB.min.z);
    const maxZ = Math.ceil(playerAABB.max.z);
    
    for (let x = minX; x < maxX; x++) {
      for (let y = minY; y < maxY; y++) {
        for (let z = minZ; z < maxZ; z++) {
          const block = this.chunkManager.getBlock(x, y, z);
          if (isBlockSolid(block)) {
            const blockAABB = new THREE.Box3(
              new THREE.Vector3(x, y, z),
              new THREE.Vector3(x + 1, y + 1, z + 1)
            );
            if (playerAABB.intersectsBox(blockAABB)) {
              if (axis.x !== 0) {
                if (this.velocity.x > 0) this.position.x = blockAABB.min.x - PLAYER_WIDTH/2;
                else if (this.velocity.x < 0) this.position.x = blockAABB.max.x + PLAYER_WIDTH/2;
                this.velocity.x = 0;
              } else if (axis.y !== 0) {
                if (this.velocity.y > 0) {
                  this.position.y = blockAABB.min.y - PLAYER_HEIGHT;
                  this.velocity.y = 0;
                }
                else if (this.velocity.y < 0) {
                  this.position.y = blockAABB.max.y;
                  this.onGround = true;
                  this.velocity.y = 0;
                }
              } else if (axis.z !== 0) {
                if (this.velocity.z > 0) this.position.z = blockAABB.min.z - PLAYER_WIDTH/2;
                else if (this.velocity.z < 0) this.position.z = blockAABB.max.z + PLAYER_WIDTH/2;
                this.velocity.z = 0;
              }
            }
          }
        }
      }
    }
  }
}
