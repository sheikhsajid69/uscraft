import {
  BlockId,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Z,
  CHUNK_HEIGHT,
  chunkKey,
  worldToChunk,
} from "@voxelia/shared";
import { ChunkGenerator } from "./ChunkGenerator.js";
import { WorldDatabase } from "./Database.js";

/**
 * In-memory world state that owns generated chunk data and persists block edits to SQLite.
 *
 * Acts as a cache layer in front of the {@link ChunkGenerator}: chunks are
 * generated on first access, overlaid with persisted database edits, and retained
 * for subsequent reads and mutations.
 */
export class WorldStore {
  private readonly chunks = new Map<string, Uint8Array>();
  private readonly generator: ChunkGenerator;
  public readonly db: WorldDatabase;
  private readonly persistedEdits: Map<string, number>;

  constructor(generator?: ChunkGenerator, db?: WorldDatabase) {
    this.generator = generator ?? new ChunkGenerator();
    this.db = db ?? new WorldDatabase();
    this.persistedEdits = this.db.loadAllBlockEdits();
  }

  /**
   * Returns the block data for the given chunk column.
   *
   * If the chunk has not been generated yet it will be created, overlaid with
   * any persisted database edits, cached, and returned.
   *
   * @param cx - Chunk X coordinate in chunk-grid space
   * @param cz - Chunk Z coordinate in chunk-grid space
   */
  getChunk(cx: number, cz: number): Uint8Array {
    const key = chunkKey(cx, cz);
    let data = this.chunks.get(key);
    if (data === undefined) {
      data = this.generator.generateChunk(cx, cz);

      // Overlay persisted edits for this chunk column
      const baseX = cx * CHUNK_SIZE_X;
      const baseZ = cz * CHUNK_SIZE_Z;
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
          const wx = baseX + lx;
          const wz = baseZ + lz;
          for (let wy = 0; wy < CHUNK_HEIGHT; wy++) {
            const editKey = `${wx},${wy},${wz}`;
            const persistedBlock = this.persistedEdits.get(editKey);
            if (persistedBlock !== undefined) {
              const idx = lx + lz * CHUNK_SIZE_X + wy * CHUNK_SIZE_X * CHUNK_SIZE_Z;
              data[idx] = persistedBlock;
            }
          }
        }
      }

      this.chunks.set(key, data);
    }
    return data;
  }

  /**
   * Looks up a single block by its absolute world coordinates.
   */
  getBlock(wx: number, wy: number, wz: number): BlockId {
    if (wy < 0 || wy >= CHUNK_HEIGHT) {
      return BlockId.AIR;
    }

    const [cx, cz] = worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);

    const localX = ((wx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const localZ = ((wz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    const index =
      localX +
      localZ * CHUNK_SIZE_X +
      wy * CHUNK_SIZE_X * CHUNK_SIZE_Z;

    return chunk[index] as BlockId;
  }

  /**
   * Sets a single block at the given world coordinates and persists to SQLite.
   */
  setBlock(wx: number, wy: number, wz: number, block: BlockId): void {
    if (wy < 0 || wy >= CHUNK_HEIGHT) {
      return;
    }

    const [cx, cz] = worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);

    const localX = ((wx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const localZ = ((wz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    const index =
      localX +
      localZ * CHUNK_SIZE_X +
      wy * CHUNK_SIZE_X * CHUNK_SIZE_Z;

    chunk[index] = block;

    // Persist to database
    this.persistedEdits.set(`${wx},${wy},${wz}`, block);
    this.db.saveBlockEdit(wx, wy, wz, block);
  }
}
