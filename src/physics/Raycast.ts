import * as THREE from 'three';
import { BlockType } from '../shared/blocks';
import { isBlockSolid } from '../world/BlockRegistry';

export interface RaycastHit {
  position: THREE.Vector3;  // block position (integer)
  normal: THREE.Vector3;    // face normal (unit vector, axis-aligned)
  distance: number;         // distance from origin
  blockType: BlockType;
}

export function raycastBlocks(
  origin: THREE.Vector3,
  direction: THREE.Vector3,  // must be normalized
  maxDistance: number,
  getBlock: (x: number, y: number, z: number) => BlockType
): RaycastHit | null {
  // DDA / Amanatides-Woo
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);

  const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

  let tMaxX = stepX > 0 ? (Math.floor(origin.x) + 1 - origin.x) * tDeltaX : (origin.x - Math.floor(origin.x)) * tDeltaX;
  if (Number.isNaN(tMaxX)) tMaxX = Infinity;
  let tMaxY = stepY > 0 ? (Math.floor(origin.y) + 1 - origin.y) * tDeltaY : (origin.y - Math.floor(origin.y)) * tDeltaY;
  if (Number.isNaN(tMaxY)) tMaxY = Infinity;
  let tMaxZ = stepZ > 0 ? (Math.floor(origin.z) + 1 - origin.z) * tDeltaZ : (origin.z - Math.floor(origin.z)) * tDeltaZ;
  if (Number.isNaN(tMaxZ)) tMaxZ = Infinity;

  let normal = new THREE.Vector3(0, 0, 0);
  let t = 0;

  while (t <= maxDistance) {
    const block = getBlock(x, y, z);
    if (isBlockSolid(block)) {
      return {
        position: new THREE.Vector3(x, y, z),
        normal: normal.clone(),
        distance: t,
        blockType: block
      };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        normal.set(-stepX, 0, 0);
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        normal.set(0, 0, -stepZ);
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        normal.set(0, -stepY, 0);
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        normal.set(0, 0, -stepZ);
      }
    }
  }

  return null;
}
