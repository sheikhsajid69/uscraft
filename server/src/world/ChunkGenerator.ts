import {
  BlockId,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Z,
  CHUNK_HEIGHT,
  BLOCKS_PER_CHUNK,
  ANCHOR_BBOX,
  SEA_LEVEL,
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
} from "@voxelia/shared";
import { createNoise2D, createNoise3D } from "simplex-noise";

type Noise2D = ReturnType<typeof createNoise2D>;
type Noise3D = ReturnType<typeof createNoise3D>;

/**
 * Procedural terrain generator using multi-octave simplex noise.
 *
 * Produces complete chunk columns of block data including heightmap terrain,
 * biome-aware surface blocks, cave carving, and tree placement.
 */
export class ChunkGenerator {
  private readonly heightNoise: Noise2D;
  private readonly temperatureNoise: Noise2D;
  private readonly moistureNoise: Noise2D;
  private readonly caveNoise: Noise3D;

  constructor() {
    this.heightNoise = createNoise2D();
    this.temperatureNoise = createNoise2D();
    this.moistureNoise = createNoise2D();
    this.caveNoise = createNoise3D();
  }

  /**
   * Generate a full chunk column of block data.
   *
   * @param cx - Chunk X coordinate in chunk-grid space
   * @param cz - Chunk Z coordinate in chunk-grid space
   * @returns Flat `Uint8Array` of `BlockId` values with length `BLOCKS_PER_CHUNK`
   */
  generateChunk(cx: number, cz: number): Uint8Array {
    const blocks = new Uint8Array(BLOCKS_PER_CHUNK);

    // First pass: terrain generation per column
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        const wx = cx * CHUNK_SIZE_X + x;
        const wz = cz * CHUNK_SIZE_Z + z;

        // Skip columns inside the anchor bounding box — leave as AIR so
        // the hand-modeled GLB set piece is not overwritten.
        if (
          wx >= ANCHOR_BBOX.minX &&
          wx <= ANCHOR_BBOX.maxX &&
          wz >= ANCHOR_BBOX.minZ &&
          wz <= ANCHOR_BBOX.maxZ
        ) {
          continue;
        }

        // ── Height ───────────────────────────────────────────────────────
        const heightValue = this.fractalNoise2D(wx, wz);
        const terrainHeight = Math.floor(
          SEA_LEVEL + heightValue * TERRAIN_HEIGHT_SCALE,
        );

        // ── Biome ────────────────────────────────────────────────────────
        const temperature = this.temperatureNoise(
          wx * BIOME_SCALE,
          wz * BIOME_SCALE,
        );
        const moisture = this.moistureNoise(
          wx * BIOME_SCALE,
          wz * BIOME_SCALE,
        );

        const surfaceBlock = this.selectSurfaceBlock(temperature, moisture);

        // ── Fill column ──────────────────────────────────────────────────
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;

          if (y === 0) {
            blocks[index] = BlockId.BEDROCK;
          } else if (y < terrainHeight - 4) {
            blocks[index] = BlockId.STONE;
          } else if (y < terrainHeight - 1) {
            blocks[index] = BlockId.DIRT;
          } else if (y === terrainHeight - 1) {
            blocks[index] = surfaceBlock;
          } else if (y < SEA_LEVEL && y >= terrainHeight) {
            blocks[index] = BlockId.WATER;
          } else {
            blocks[index] = BlockId.AIR;
          }
        }

        // ── Cave carving ─────────────────────────────────────────────────
        for (let y = CAVE_MIN_Y + 1; y < terrainHeight - 5; y++) {
          const caveValue = this.caveNoise(
            wx * CAVE_SCALE,
            y * CAVE_SCALE,
            wz * CAVE_SCALE,
          );
          if (caveValue > CAVE_THRESHOLD) {
            const index =
              x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
            blocks[index] = BlockId.AIR;
          }
        }

        // ── Trees ────────────────────────────────────────────────────────
        if (
          surfaceBlock === BlockId.GRASS &&
          terrainHeight > SEA_LEVEL &&
          this.shouldPlaceTree(wx, wz)
        ) {
          this.placeTree(blocks, x, z, terrainHeight);
        }
      }
    }

    return blocks;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Multi-octave fractal Brownian motion using 2D simplex noise.
   * Produces smooth, natural-looking terrain elevation values.
   */
  private fractalNoise2D(x: number, z: number): number {
    let amplitude = 1.0;
    let frequency = TERRAIN_SCALE;
    let value = 0;
    let maxAmplitude = 0;

    for (let i = 0; i < TERRAIN_OCTAVES; i++) {
      value += this.heightNoise(x * frequency, z * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= TERRAIN_PERSISTENCE;
      frequency *= TERRAIN_LACUNARITY;
    }

    // Normalise to roughly [-1, 1]
    return value / maxAmplitude;
  }

  /**
   * Selects the surface block type based on biome noise values.
   *
   * - Hot + dry  → SAND
   * - Cold       → SNOW
   * - Otherwise  → GRASS (temperate)
   */
  private selectSurfaceBlock(
    temperature: number,
    moisture: number,
  ): BlockId {
    if (temperature > 0.3 && moisture < -0.2) {
      return BlockId.SAND;
    }
    if (temperature < -0.3) {
      return BlockId.SNOW;
    }
    return BlockId.GRASS;
  }

  /**
   * Deterministic hash check to decide whether to place a tree at a given
   * world position.  Uses a fast integer hash so tree placement is stable
   * across separate generation runs with the same coordinates.
   */
  private shouldPlaceTree(wx: number, wz: number): boolean {
    const hash = this.positionHash(wx, wz);
    // Map the hash into [0, 1) and compare against density
    return (hash & 0xffff) / 0x10000 < TREE_DENSITY;
  }

  /**
   * Simple deterministic integer hash for two coordinates.
   * Based on a stripped-down variant of the Jenkins one-at-a-time hash.
   */
  private positionHash(x: number, z: number): number {
    let h = (x * 374761393 + z * 668265263 + 1274126177) | 0;
    h = (h ^ (h >> 13)) | 0;
    h = (h * 1274126177) | 0;
    h = (h ^ (h >> 16)) | 0;
    return h >>> 0; // force unsigned
  }

  /**
   * Places a tree at the given local (x, z) position starting at the
   * given surface height.
   *
   * Tree structure:
   *   - 5-block WOOD trunk from `surfaceY` to `surfaceY + 4`
   *   - 3×3×3 LEAVES cap centred on trunk top (`surfaceY + 3` to `surfaceY + 5`)
   *
   * Only writes blocks that fit within the chunk's column boundaries.
   */
  private placeTree(
    blocks: Uint8Array,
    localX: number,
    localZ: number,
    surfaceY: number,
  ): void {
    const trunkHeight = 5;

    // Trunk
    for (let dy = 0; dy < trunkHeight; dy++) {
      const y = surfaceY + dy;
      if (y >= CHUNK_HEIGHT) break;
      const index =
        localX +
        localZ * CHUNK_SIZE_X +
        y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
      blocks[index] = BlockId.WOOD;
    }

    // Leaves — 3×3×3 cube centred on the trunk top
    const leafBaseY = surfaceY + trunkHeight - 2; // surfaceY + 3
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const lx = localX + dx;
          const lz = localZ + dz;
          const ly = leafBaseY + dy;

          // Only place leaves inside this chunk's column bounds
          if (
            lx < 0 ||
            lx >= CHUNK_SIZE_X ||
            lz < 0 ||
            lz >= CHUNK_SIZE_Z ||
            ly >= CHUNK_HEIGHT
          ) {
            continue;
          }

          const index =
            lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z;

          // Don't overwrite the trunk
          if (blocks[index] !== BlockId.WOOD) {
            blocks[index] = BlockId.LEAVES;
          }
        }
      }
    }
  }
}
