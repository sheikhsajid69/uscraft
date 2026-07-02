// ── Chunk dimensions ────────────────────────────────────────────────────────
/** Number of blocks along the X axis of a single chunk. */
export const CHUNK_SIZE_X = 16;
/** Number of blocks along the Z axis of a single chunk. */
export const CHUNK_SIZE_Z = 16;
/** Total vertical height of a chunk in blocks. */
export const CHUNK_HEIGHT = 256;

// ── World generation ────────────────────────────────────────────────────────
/** Y-level of the water surface. */
export const SEA_LEVEL = 64;
/** How many chunks the client keeps meshed around the player. */
export const RENDER_DISTANCE = 14;

/** Default seed fed to the noise generator. */
export const NOISE_SEED = 42;

/** Base frequency of the terrain height noise. */
export const TERRAIN_SCALE = 0.01;
/** Number of octaves for fractal Brownian motion terrain noise. */
export const TERRAIN_OCTAVES = 4;
/** Amplitude decay per octave. */
export const TERRAIN_PERSISTENCE = 0.5;
/** Frequency multiplier per octave. */
export const TERRAIN_LACUNARITY = 2.0;
/** Maximum additional height above SEA_LEVEL produced by the height map. */
export const TERRAIN_HEIGHT_SCALE = 45;

/** Frequency of the 3-D noise used for cave carving. */
export const CAVE_SCALE = 0.05;
/** Noise values above this threshold are carved as cave air. */
export const CAVE_THRESHOLD = 0.3;
/** Caves are never carved below this Y-level (protects bedrock). */
export const CAVE_MIN_Y = 10;

/** Probability per valid surface column that a tree spawns. */
export const TREE_DENSITY = 0.02;
/** Frequency of the biome classification noise. */
export const BIOME_SCALE = 0.002;
/** Number of distinct biome types in the world generator. */
export const BIOME_COUNT = 6;

// ── Derived constants ───────────────────────────────────────────────────────
/** Total number of block slots in a single chunk (X × Z × HEIGHT). */
export const BLOCKS_PER_CHUNK = CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_HEIGHT;

/** World-space bounding box that limits the playable area (XZ plane). */
export const ANCHOR_BBOX = {
  minX: -50,
  maxX: 50,
  minZ: -50,
  maxZ: 50,
} as const;
