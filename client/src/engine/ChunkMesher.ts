import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import {
  BlockId,
  BLOCK_DEFS,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Z,
  CHUNK_HEIGHT,
} from '@voxelia/shared';
import { getBlockFaceUV } from './TextureAtlas';

// ── Face definitions ─────────────────────────────────────────────────────────
// Each face: direction offset, 4 corner vertices, outward normal, and the
// 3-neighbor AO sample offsets for each corner vertex.

interface FaceDef {
  dir: [number, number, number];
  corners: [number, number, number][];
  normal: [number, number, number];
  /**
   * For each of the 4 corner vertices, the 3 neighbour offsets used to
   * compute ambient occlusion. Each entry is [side1, side2, corner].
   * The AO value is determined by how many of these 3 positions are solid.
   */
  aoNeighbors: [number, number, number][][];
}

// AO neighbour offsets per face per corner, following Minecraft's method.
// For each face (defined by its normal direction), each corner vertex
// has 2 edge neighbours and 1 diagonal neighbour in the face plane.

const FACES: readonly FaceDef[] = [
  // Top (+Y) — y+1 plane
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 0], // 0: -x, -z
      [1, 1, 0], // 1: +x, -z
      [1, 1, 1], // 2: +x, +z
      [0, 1, 1], // 3: -x, +z
    ],
    normal: [0, 1, 0],
    aoNeighbors: [
      [[-1, 1, 0], [0, 1, -1], [-1, 1, -1]], // corner 0
      [[1, 1, 0], [0, 1, -1], [1, 1, -1]],   // corner 1
      [[1, 1, 0], [0, 1, 1], [1, 1, 1]],     // corner 2
      [[-1, 1, 0], [0, 1, 1], [-1, 1, 1]],   // corner 3
    ],
  },
  // Bottom (-Y) — y-1 plane
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
      [0, 0, 0],
    ],
    normal: [0, -1, 0],
    aoNeighbors: [
      [[-1, -1, 0], [0, -1, 1], [-1, -1, 1]],
      [[1, -1, 0], [0, -1, 1], [1, -1, 1]],
      [[1, -1, 0], [0, -1, -1], [1, -1, -1]],
      [[-1, -1, 0], [0, -1, -1], [-1, -1, -1]],
    ],
  },
  // North (+Z)
  {
    dir: [0, 0, 1],
    corners: [
      [1, 0, 1],
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ],
    normal: [0, 0, 1],
    aoNeighbors: [
      [[1, 0, 1], [0, -1, 1], [1, -1, 1]],
      [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]],
      [[-1, 0, 1], [0, 1, 1], [-1, 1, 1]],
      [[1, 0, 1], [0, 1, 1], [1, 1, 1]],
    ],
  },
  // South (-Z)
  {
    dir: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    normal: [0, 0, -1],
    aoNeighbors: [
      [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]],
      [[1, 0, -1], [0, -1, -1], [1, -1, -1]],
      [[1, 0, -1], [0, 1, -1], [1, 1, -1]],
      [[-1, 0, -1], [0, 1, -1], [-1, 1, -1]],
    ],
  },
  // East (+X)
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
    normal: [1, 0, 0],
    aoNeighbors: [
      [[1, 0, -1], [1, -1, 0], [1, -1, -1]],
      [[1, 0, 1], [1, -1, 0], [1, -1, 1]],
      [[1, 0, 1], [1, 1, 0], [1, 1, 1]],
      [[1, 0, -1], [1, 1, 0], [1, 1, -1]],
    ],
  },
  // West (-X)
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    normal: [-1, 0, 0],
    aoNeighbors: [
      [[-1, 0, 1], [-1, -1, 0], [-1, -1, 1]],
      [[-1, 0, -1], [-1, -1, 0], [-1, -1, -1]],
      [[-1, 0, -1], [-1, 1, 0], [-1, 1, -1]],
      [[-1, 0, 1], [-1, 1, 0], [-1, 1, 1]],
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a hex colour integer to normalised [r, g, b]. */
function hexToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

/** Compute the flat array index for block at (x, y, z) within a chunk. */
function blockIndex(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
}

/** Check if position is inside chunk bounds. */
function inBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < CHUNK_SIZE_X && y >= 0 && y < CHUNK_HEIGHT && z >= 0 && z < CHUNK_SIZE_Z;
}

/** Check whether a BlockId is transparent (should expose neighbour faces). */
function isBlockTransparent(blocks: Uint8Array, x: number, y: number, z: number): boolean {
  if (!inBounds(x, y, z)) return true;
  const id = blocks[blockIndex(x, y, z)] as BlockId;
  const def = BLOCK_DEFS[id];
  return def !== undefined ? def.transparent : true;
}

/** Check whether a block at a position is solid (for AO computation). */
function isBlockSolid(blocks: Uint8Array, x: number, y: number, z: number): boolean {
  if (!inBounds(x, y, z)) return false;
  const id = blocks[blockIndex(x, y, z)] as BlockId;
  const def = BLOCK_DEFS[id];
  return def !== undefined ? def.solid : false;
}

/**
 * Compute vertex AO level (0=fully occluded, 3=fully lit).
 * Standard Minecraft-style 4-sample: side1, side2, corner.
 */
function vertexAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0;
  return 3 - (side1 ? 1 : 0) - (side2 ? 1 : 0) - (corner ? 1 : 0);
}

/** Map AO level (0-3) to a light multiplier. */
const AO_CURVE = [0.45, 0.65, 0.85, 1.0];

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a `BufferGeometry` for a 16×256×16 chunk column using culled-face
 * meshing with per-vertex ambient occlusion and texture atlas UVs.
 *
 * Vertex colours are tinted by block color and modulated by AO.
 * UV coordinates map to the correct tile in the texture atlas.
 *
 * @returns The geometry, or `null` when the chunk is entirely air.
 */
export function buildChunkMesh(
  blocks: Uint8Array,
  cx: number,
  cz: number,
): BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const worldOffsetX = cx * CHUNK_SIZE_X;
  const worldOffsetZ = cz * CHUNK_SIZE_Z;

  let vertexCount = 0;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE_Z; z++) {
      for (let x = 0; x < CHUNK_SIZE_X; x++) {
        const id = blocks[blockIndex(x, y, z)] as BlockId;

        // Skip air and water (water gets a separate pass later)
        if (id === BlockId.AIR || id === BlockId.WATER) continue;

        const def = BLOCK_DEFS[id];
        if (!def) continue;

        const [baseR, baseG, baseB] = hexToRgb(def.color);

        for (let faceIdx = 0; faceIdx < FACES.length; faceIdx++) {
          const face = FACES[faceIdx];
          const [dx, dy, dz] = face.dir;
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;

          // Only emit face if neighbour is transparent
          if (!isBlockTransparent(blocks, nx, ny, nz)) continue;

          // Get atlas UVs for this block + face
          const tile = getBlockFaceUV(id, faceIdx);

          // Compute AO for each of the 4 corner vertices
          const aoLevels: number[] = [];
          for (let ci = 0; ci < 4; ci++) {
            const neighbors = face.aoNeighbors[ci];
            const s1 = isBlockSolid(blocks, x + neighbors[0][0], y + neighbors[0][1], z + neighbors[0][2]);
            const s2 = isBlockSolid(blocks, x + neighbors[1][0], y + neighbors[1][1], z + neighbors[1][2]);
            const c = isBlockSolid(blocks, x + neighbors[2][0], y + neighbors[2][1], z + neighbors[2][2]);
            aoLevels.push(vertexAO(s1, s2, c));
          }

          // UV corners for the quad
          const quadUVs: [number, number][] = [
            [tile.u0, tile.v0], // corner 0
            [tile.u1, tile.v0], // corner 1
            [tile.u1, tile.v1], // corner 2
            [tile.u0, tile.v1], // corner 3
          ];

          // Emit 4 vertices
          const baseIdx = vertexCount;
          for (let ci = 0; ci < 4; ci++) {
            const corner = face.corners[ci];
            positions.push(
              corner[0] + x + worldOffsetX,
              corner[1] + y,
              corner[2] + z + worldOffsetZ,
            );
            normals.push(face.normal[0], face.normal[1], face.normal[2]);

            // Vertex color = block color * AO
            const ao = AO_CURVE[aoLevels[ci]];
            colors.push(baseR * ao, baseG * ao, baseB * ao);

            uvs.push(quadUVs[ci][0], quadUVs[ci][1]);
            vertexCount++;
          }

          // Anisotropy fix: flip triangle winding when AO is uneven
          // to prevent the dark diagonal artifact
          if (aoLevels[0] + aoLevels[2] > aoLevels[1] + aoLevels[3]) {
            // Normal winding: 0-1-2, 0-2-3
            indices.push(
              baseIdx, baseIdx + 1, baseIdx + 2,
              baseIdx, baseIdx + 2, baseIdx + 3,
            );
          } else {
            // Flipped winding: 1-2-3, 1-3-0
            indices.push(
              baseIdx + 1, baseIdx + 2, baseIdx + 3,
              baseIdx + 1, baseIdx + 3, baseIdx,
            );
          }
        }
      }
    }
  }

  if (vertexCount === 0) return null;

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    'normal',
    new Float32BufferAttribute(new Float32Array(normals), 3),
  );
  geometry.setAttribute(
    'color',
    new Float32BufferAttribute(new Float32Array(colors), 3),
  );
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(new Float32Array(uvs), 2),
  );

  // Use Uint16 indices if vertex count allows, otherwise Uint32
  if (vertexCount <= 65535) {
    geometry.setIndex(new Uint16BufferAttribute(new Uint16Array(indices), 1));
  } else {
    geometry.setIndex(indices);
  }

  return geometry;
}
