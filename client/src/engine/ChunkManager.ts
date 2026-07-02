import { Scene, Mesh, MeshLambertMaterial, NearestFilter } from 'three';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import {
  BlockId,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Z,
  CHUNK_HEIGHT,
  BLOCKS_PER_CHUNK,
  SEA_LEVEL,
  RENDER_DISTANCE,
  TERRAIN_SCALE,
  TERRAIN_OCTAVES,
  TERRAIN_PERSISTENCE,
  TERRAIN_LACUNARITY,
  TERRAIN_HEIGHT_SCALE,
  CAVE_SCALE,
  CAVE_THRESHOLD,
  CAVE_MIN_Y,
  TREE_DENSITY,
  BIOME_SCALE,
  chunkKey,
  worldToChunk,
} from '@voxelia/shared';
import { buildChunkMesh } from './ChunkMesher';
import { createAtlasTexture } from './TextureAtlas';
import { WaterMesher } from './WaterMesher';
import { gameStats } from '../ui/stats';

// ── Seeded PRNG (simple mulberry32) ──────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 42;
const rng = mulberry32(SEED);
const noise2D = createNoise2D(rng);

const rng2 = mulberry32(SEED + 1337);
const noise3D = createNoise3D(rng2);

// Dual-axis biome noise: temperature + moisture
const rng3 = mulberry32(SEED + 7919);
const tempNoise2D = createNoise2D(rng3);
const rng4 = mulberry32(SEED + 31337);
const moistNoise2D = createNoise2D(rng4);

// Tree hash noise
const rng5 = mulberry32(SEED + 65537);
const treeNoise2D = createNoise2D(rng5);

// ── Biome system ─────────────────────────────────────────────────────────────
// 0=PLAINS, 1=FOREST, 2=DESERT, 3=SNOWY_MOUNTAINS, 4=SWAMP, 5=TEMPLE_RUINS
const enum Biome {
  PLAINS = 0,
  FOREST = 1,
  DESERT = 2,
  SNOWY_MOUNTAINS = 3,
  SWAMP = 4,
  TEMPLE_RUINS = 5,
}

interface BiomeDef {
  surface: BlockId;
  subsurface: BlockId;
  treeDensity: number;
  heightMod: number;    // multiplier on terrain height
  treeMinHeight: number;
  treeMaxHeight: number;
}

const BIOME_DEFS: Record<Biome, BiomeDef> = {
  [Biome.PLAINS]: {
    surface: BlockId.GRASS, subsurface: BlockId.DIRT,
    treeDensity: 0.008, heightMod: 0.7, treeMinHeight: 4, treeMaxHeight: 6,
  },
  [Biome.FOREST]: {
    surface: BlockId.GRASS, subsurface: BlockId.DIRT,
    treeDensity: 0.06, heightMod: 0.9, treeMinHeight: 5, treeMaxHeight: 8,
  },
  [Biome.DESERT]: {
    surface: BlockId.SAND, subsurface: BlockId.SAND,
    treeDensity: 0.001, heightMod: 0.5, treeMinHeight: 3, treeMaxHeight: 5,
  },
  [Biome.SNOWY_MOUNTAINS]: {
    surface: BlockId.SNOW, subsurface: BlockId.STONE,
    treeDensity: 0.01, heightMod: 1.5, treeMinHeight: 4, treeMaxHeight: 6,
  },
  [Biome.SWAMP]: {
    surface: BlockId.GRASS, subsurface: BlockId.DIRT,
    treeDensity: 0.03, heightMod: 0.3, treeMinHeight: 3, treeMaxHeight: 5,
  },
  [Biome.TEMPLE_RUINS]: {
    surface: BlockId.GRASS, subsurface: BlockId.STONE,
    treeDensity: 0.005, heightMod: 0.4, treeMinHeight: 5, treeMaxHeight: 7,
  },
};

function classifyBiome(wx: number, wz: number): Biome {
  const temp = tempNoise2D(wx * BIOME_SCALE, wz * BIOME_SCALE);
  const moist = moistNoise2D(wx * BIOME_SCALE * 1.3, wz * BIOME_SCALE * 1.3);

  // Temple ruins: rare biome in a narrow noise band
  if (temp > 0.05 && temp < 0.15 && moist > 0.2 && moist < 0.35) return Biome.TEMPLE_RUINS;

  if (temp > 0.35) return Biome.DESERT;
  if (temp < -0.35) return Biome.SNOWY_MOUNTAINS;
  if (moist > 0.25) return Biome.SWAMP;
  if (moist < -0.15) return Biome.FOREST;
  return Biome.PLAINS;
}

// ── Anchor integration ───────────────────────────────────────────────────────
// Set by GameEngine after loading the anchor GLB.
let anchorMinX = -50;
let anchorMaxX = 50;
let anchorMinZ = -50;
let anchorMaxZ = 50;
let anchorBaseY = 64; // filled terrain up to here under the anchor
const ANCHOR_SKIRT = 3;

export function setAnchorBounds(
  minX: number, maxX: number,
  minZ: number, maxZ: number,
  baseY: number,
): void {
  anchorMinX = Math.floor(minX);
  anchorMaxX = Math.ceil(maxX);
  anchorMinZ = Math.floor(minZ);
  anchorMaxZ = Math.ceil(maxZ);
  anchorBaseY = Math.floor(baseY);
  console.log(`[ChunkManager] Anchor bounds set: X[${anchorMinX}..${anchorMaxX}] Z[${anchorMinZ}..${anchorMaxZ}] baseY=${anchorBaseY}`);
}

// ── Shared material with atlas texture ───────────────────────────────────────
const atlasTexture = createAtlasTexture();
atlasTexture.magFilter = NearestFilter;
atlasTexture.minFilter = NearestFilter;

const chunkMaterial = new MeshLambertMaterial({
  vertexColors: true,
  map: atlasTexture,
});

// ── Terrain generation ───────────────────────────────────────────────────────

function fbm2D(x: number, z: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < TERRAIN_OCTAVES; i++) {
    value += noise2D(x * TERRAIN_SCALE * frequency, z * TERRAIN_SCALE * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= TERRAIN_PERSISTENCE;
    frequency *= TERRAIN_LACUNARITY;
  }

  return (value / maxAmplitude + 1) * 0.5;
}

function getHeight(wx: number, wz: number, biome: Biome): number {
  const n = fbm2D(wx, wz);
  const biomeDef = BIOME_DEFS[biome];
  return Math.floor(SEA_LEVEL + n * TERRAIN_HEIGHT_SCALE * biomeDef.heightMod);
}

/**
 * Returns the terrain height at a world coordinate for external queries
 * (used by PlayerController for ground collision).
 */
export function queryTerrainHeight(wx: number, wz: number): number {
  // Anchor area: return anchor base Y
  if (wx >= anchorMinX && wx <= anchorMaxX && wz >= anchorMinZ && wz <= anchorMaxZ) {
    return anchorBaseY;
  }
  const biome = classifyBiome(wx, wz);
  return getHeight(wx, wz, biome);
}

/** Generate the block data for one chunk column. */
function generateChunkData(cx: number, cz: number): Uint8Array {
  const blocks = new Uint8Array(BLOCKS_PER_CHUNK);

  const baseX = cx * CHUNK_SIZE_X;
  const baseZ = cz * CHUNK_SIZE_Z;

  const surfaceHeights: number[] = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
  const biomes: Biome[] = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);

  // ── Pass 1: solid terrain ────────────────────────────────────────────────
  for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const biome = classifyBiome(wx, wz);
      const biomeDef = BIOME_DEFS[biome];
      const colIdx = lx + lz * CHUNK_SIZE_X;
      biomes[colIdx] = biome;

      // ── Anchor integration: conform terrain to GLB base ────────────
      const inAnchor = wx >= anchorMinX && wx <= anchorMaxX &&
                       wz >= anchorMinZ && wz <= anchorMaxZ;
      const distToAnchorEdge = inAnchor ? 0 : Math.max(
        0,
        Math.max(anchorMinX - wx, wx - anchorMaxX),
        Math.max(anchorMinZ - wz, wz - anchorMaxZ),
      );
      const nearAnchorEdge = !inAnchor && distToAnchorEdge <= ANCHOR_SKIRT;

      let height: number;
      if (inAnchor) {
        // Under the anchor: fill terrain solidly up to the anchor base
        height = anchorBaseY;
      } else if (nearAnchorEdge) {
        // Skirt zone: lerp between anchor base and natural terrain
        const naturalHeight = getHeight(wx, wz, biome);
        const t = distToAnchorEdge / ANCHOR_SKIRT;
        height = Math.floor(anchorBaseY * (1 - t) + naturalHeight * t);
      } else {
        height = getHeight(wx, wz, biome);
      }

      surfaceHeights[colIdx] = height;

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const idx = lx + lz * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;

        if (y === 0) {
          blocks[idx] = BlockId.BEDROCK;
        } else if (y < height - 4) {
          blocks[idx] = BlockId.STONE;
        } else if (y < height) {
          blocks[idx] = inAnchor || nearAnchorEdge
            ? BlockId.DIRT
            : biomeDef.subsurface;
        } else if (y === height) {
          blocks[idx] = inAnchor || nearAnchorEdge
            ? BlockId.DIRT
            : biomeDef.surface;
        } else if (y <= SEA_LEVEL && y > height) {
          blocks[idx] = BlockId.WATER;
        } else {
          blocks[idx] = BlockId.AIR;
        }
      }
    }
  }

  // ── Pass 2: cave carving ─────────────────────────────────────────────────
  for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const colIdx = lx + lz * CHUNK_SIZE_X;
      const surface = surfaceHeights[colIdx];

      // No caves under anchor area
      if (wx >= anchorMinX && wx <= anchorMaxX &&
          wz >= anchorMinZ && wz <= anchorMaxZ) continue;

      for (let y = CAVE_MIN_Y; y < surface - 1; y++) {
        const caveVal = noise3D(
          wx * CAVE_SCALE,
          y * CAVE_SCALE,
          wz * CAVE_SCALE,
        );
        if (caveVal > CAVE_THRESHOLD) {
          const idx = lx + lz * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
          blocks[idx] = BlockId.AIR;
        }
      }
    }
  }

  // ── Pass 3: trees ────────────────────────────────────────────────────────
  for (let lz = 2; lz < CHUNK_SIZE_Z - 2; lz++) {
    for (let lx = 2; lx < CHUNK_SIZE_X - 2; lx++) {
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const colIdx = lx + lz * CHUNK_SIZE_X;
      const biome = biomes[colIdx];
      const biomeDef = BIOME_DEFS[biome];

      // No trees in anchor area
      if (wx >= anchorMinX - 3 && wx <= anchorMaxX + 3 &&
          wz >= anchorMinZ - 3 && wz <= anchorMaxZ + 3) continue;

      // Trees only on grass or snow surfaces
      if (biomeDef.surface !== BlockId.GRASS && biomeDef.surface !== BlockId.SNOW) continue;

      const surface = surfaceHeights[colIdx];
      if (surface <= SEA_LEVEL) continue;

      const treeVal = (treeNoise2D(wx * 0.8, wz * 0.8) + 1) * 0.5;
      if (treeVal > biomeDef.treeDensity) continue;

      const trunkHeight = biomeDef.treeMinHeight +
        Math.floor(treeVal * 500) % (biomeDef.treeMaxHeight - biomeDef.treeMinHeight + 1);
      const trunkBase = surface + 1;

      // Trunk
      for (let ty = 0; ty < trunkHeight; ty++) {
        const y = trunkBase + ty;
        if (y >= CHUNK_HEIGHT) break;
        const idx = lx + lz * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
        blocks[idx] = BlockId.WOOD;
      }

      // Leaf canopy (sphere-ish)
      const leafCenter = trunkBase + trunkHeight - 1;
      const leafRadius = biome === Biome.FOREST ? 3 : 2;
      for (let dy = -1; dy <= 2; dy++) {
        for (let dz2 = -leafRadius; dz2 <= leafRadius; dz2++) {
          for (let dx2 = -leafRadius; dx2 <= leafRadius; dx2++) {
            const lxn = lx + dx2;
            const lzn = lz + dz2;
            const ly = leafCenter + dy;

            if (lxn < 0 || lxn >= CHUNK_SIZE_X ||
                lzn < 0 || lzn >= CHUNK_SIZE_Z ||
                ly < 0 || ly >= CHUNK_HEIGHT) continue;

            const dist = dx2 * dx2 + dy * dy + dz2 * dz2;
            if (dist > leafRadius * leafRadius + 1) continue;

            const idx = lxn + lzn * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
            if (blocks[idx] === BlockId.AIR) {
              blocks[idx] = BlockId.LEAVES;
            }
          }
        }
      }
    }
  }

  return blocks;
}

// ── Precomputed spiral offsets sorted by distance from camera ───────────────
const SPIRAL_OFFSETS: [number, number][] = [];
for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
  for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
    if (dx * dx + dz * dz <= RENDER_DISTANCE * RENDER_DISTANCE) {
      SPIRAL_OFFSETS.push([dx, dz]);
    }
  }
}
SPIRAL_OFFSETS.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));

// ── ChunkManager ─────────────────────────────────────────────────────────────

export class ChunkManager {
  private readonly meshes = new Map<string, Mesh>();
  private readonly waterMeshes = new Map<string, Mesh>();
  private readonly chunkData = new Map<string, Uint8Array>();
  private readonly scene: Scene;
  public readonly waterMesher = new WaterMesher();

  private static readonly MAX_CHUNKS_PER_FRAME = 3;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public update(cameraX: number, cameraZ: number, dt: number = 0): void {
    this.waterMesher.update(dt);
    const [camCX, camCZ] = worldToChunk(cameraX, cameraZ);

    // ── Load new chunks (spiral outward from camera) ─────────────────────
    let built = 0;
    for (const [dx, dz] of SPIRAL_OFFSETS) {
      if (built >= ChunkManager.MAX_CHUNKS_PER_FRAME) break;

      const ccx = camCX + dx;
      const ccz = camCZ + dz;
      const key = chunkKey(ccx, ccz);

      if (this.meshes.has(key)) continue;

      const blocks = generateChunkData(ccx, ccz);
      this.chunkData.set(key, blocks);

      const geometry = buildChunkMesh(blocks, ccx, ccz);
      if (geometry) {
        const mesh = new Mesh(geometry, chunkMaterial);
        mesh.frustumCulled = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.meshes.set(key, mesh);
      } else {
        const sentinel = new Mesh();
        sentinel.visible = false;
        this.meshes.set(key, sentinel);
      }

      const waterMesh = this.waterMesher.buildWaterMesh(blocks);
      if (waterMesh) {
        waterMesh.position.set(ccx * CHUNK_SIZE_X, 0, ccz * CHUNK_SIZE_Z);
        this.scene.add(waterMesh);
        this.waterMeshes.set(key, waterMesh);
      }

      built++;
    }

    // ── Unload distant chunks ────────────────────────────────────────────
    const unloadDist = RENDER_DISTANCE + 2;
    const unloadDistSq = unloadDist * unloadDist;

    for (const [key, mesh] of this.meshes) {
      const commaIdx = key.indexOf(',');
      const kcx = Number(key.slice(0, commaIdx));
      const kcz = Number(key.slice(commaIdx + 1));

      const ddx = kcx - camCX;
      const ddz = kcz - camCZ;
      if (ddx * ddx + ddz * ddz > unloadDistSq) {
        this.scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        this.meshes.delete(key);
        this.chunkData.delete(key);

        const wMesh = this.waterMeshes.get(key);
        if (wMesh) {
          this.scene.remove(wMesh);
          if (wMesh.geometry) wMesh.geometry.dispose();
          this.waterMeshes.delete(key);
        }
      }
    }

    gameStats.chunkCount = this.meshes.size;
  }

  /** Look up a block in the generated chunks. */
  public getBlock(wx: number, wy: number, wz: number): BlockId {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockId.AIR;
    const [cx, cz] = worldToChunk(wx, wz);
    const key = chunkKey(cx, cz);
    const blocks = this.chunkData.get(key);
    if (!blocks) return BlockId.AIR;
    const lx = ((wx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((wz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    return blocks[lx + lz * CHUNK_SIZE_X + wy * CHUNK_SIZE_X * CHUNK_SIZE_Z] as BlockId;
  }

  /** Modifies a voxel block locally and triggers real-time mesh rebuilding. */
  public setBlock(wx: number, wy: number, wz: number, blockId: BlockId): void {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const [cx, cz] = worldToChunk(wx, wz);
    const key = chunkKey(cx, cz);
    const blocks = this.chunkData.get(key);
    if (!blocks) return;
    const lx = ((wx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((wz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    blocks[lx + lz * CHUNK_SIZE_X + wy * CHUNK_SIZE_X * CHUNK_SIZE_Z] = blockId;
    this.rebuildChunk(cx, cz);

    // Rebuild neighbors if on chunk boundary
    if (lx === 0) this.rebuildChunk(cx - 1, cz);
    else if (lx === CHUNK_SIZE_X - 1) this.rebuildChunk(cx + 1, cz);
    if (lz === 0) this.rebuildChunk(cx, cz - 1);
    else if (lz === CHUNK_SIZE_Z - 1) this.rebuildChunk(cx, cz + 1);
  }

  /** Force immediate rebuild of a specific chunk column's mesh. */
  public rebuildChunk(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const blocks = this.chunkData.get(key);
    if (!blocks) return;

    // Remove old solid mesh
    const oldMesh = this.meshes.get(key);
    if (oldMesh) {
      this.scene.remove(oldMesh);
      if (oldMesh.geometry) oldMesh.geometry.dispose();
    }

    // Remove old water mesh
    const oldWater = this.waterMeshes.get(key);
    if (oldWater) {
      this.scene.remove(oldWater);
      if (oldWater.geometry) oldWater.geometry.dispose();
      this.waterMeshes.delete(key);
    }

    const geometry = buildChunkMesh(blocks, cx, cz);
    if (geometry) {
      const mesh = new Mesh(geometry, chunkMaterial);
      mesh.frustumCulled = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.set(key, mesh);
    } else {
      const sentinel = new Mesh();
      sentinel.visible = false;
      this.meshes.set(key, sentinel);
    }

    const waterMesh = this.waterMesher.buildWaterMesh(blocks);
    if (waterMesh) {
      waterMesh.position.set(cx * CHUNK_SIZE_X, 0, cz * CHUNK_SIZE_Z);
      this.scene.add(waterMesh);
      this.waterMeshes.set(key, waterMesh);
    }
  }

  /** Clears all generated chunk meshes and data to allow clean regeneration after anchor placement. */
  public clearAll(): void {
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
    }
    for (const mesh of this.waterMeshes.values()) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
    }
    this.meshes.clear();
    this.waterMeshes.clear();
    this.chunkData.clear();
  }
}
