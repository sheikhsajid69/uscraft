import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from "../constants/WorldGenConfig.js";

/**
 * Produces a deterministic string key for a chunk column.
 *
 * Used as a `Map` / `Set` / object key wherever chunks need to be indexed
 * by their grid coordinates.
 *
 * @example chunkKey(3, -2) // "3,-2"
 */
export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/**
 * Inverse of {@link chunkKey} — splits the string back into numeric
 * chunk coordinates.
 *
 * @example parseChunkKey("3,-2") // [3, -2]
 */
export function parseChunkKey(key: string): [number, number] {
  const idx = key.indexOf(",");
  const cx = Number(key.slice(0, idx));
  const cz = Number(key.slice(idx + 1));
  return [cx, cz];
}

/**
 * Converts a world-space coordinate pair into the chunk grid coordinates
 * that contain it.
 *
 * Uses `Math.floor` so negative world positions map correctly to the
 * chunk to their "left" (lower coordinate).
 *
 * @param wx - World X position (block units)
 * @param wz - World Z position (block units)
 * @returns `[chunkX, chunkZ]`
 */
export function worldToChunk(wx: number, wz: number): [number, number] {
  return [Math.floor(wx / CHUNK_SIZE_X), Math.floor(wz / CHUNK_SIZE_Z)];
}

/**
 * Returns the world-space origin (minimum corner) of the given chunk column.
 *
 * @param cx - Chunk X coordinate
 * @param cz - Chunk Z coordinate
 * @returns `[worldX, worldZ]` of the chunk's (0, 0) corner
 */
export function chunkToWorld(cx: number, cz: number): [number, number] {
  return [cx * CHUNK_SIZE_X, cz * CHUNK_SIZE_Z];
}
