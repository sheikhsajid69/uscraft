// ── Client → Server packets ─────────────────────────────────────────────────

/** Client requests the block data for a specific chunk column. */
export interface ChunkRequestPacket {
  readonly cx: number;
  readonly cz: number;
}

/** Client tells the server its latest position and look direction. */
export interface PlayerMovePacket {
  readonly playerId: string;
  /** World-space position [x, y, z]. */
  readonly position: [number, number, number];
  /** Look direction [yaw, pitch] in radians. */
  readonly rotation: [number, number];
}

/** Client breaks or places a block, or server broadcasts an edit. */
export interface BlockEditPacket {
  readonly playerId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly blockId: number;
}

// ── Server → Client packets ─────────────────────────────────────────────────

/**
 * Server sends the full block data for one chunk column.
 * `blocks` is a flat array of {@link BlockId} values whose length equals
 * `CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_HEIGHT`.
 */
export interface ChunkDataPacket {
  readonly cx: number;
  readonly cz: number;
  /** Flat array of BlockId values (length = BLOCKS_PER_CHUNK). */
  readonly blocks: number[];
}

/** Server notifies all clients that a new player has connected. */
export interface PlayerJoinPacket {
  readonly playerId: string;
  /** Initial spawn position [x, y, z]. */
  readonly position: [number, number, number];
  /** Initial rotation [yaw, pitch]. */
  readonly rotation?: [number, number];
}

/** Server notifies all clients that a player has disconnected. */
export interface PlayerLeavePacket {
  readonly playerId: string;
}

/** Server sends initial list of active players upon connection. */
export interface WorldStatePacket {
  readonly players: readonly {
    readonly playerId: string;
    readonly position: [number, number, number];
    readonly rotation: [number, number];
  }[];
  readonly blockEdits?: readonly BlockEditPacket[];
}

// ── Discriminated unions ────────────────────────────────────────────────────

/**
 * All packet types the **client** can send to the server.
 *
 * Extend this union as new client-originated events are added.
 */
export type ClientPacket = ChunkRequestPacket | PlayerMovePacket | BlockEditPacket;

/**
 * All packet types the **server** can send to clients.
 *
 * Extend this union as new server-originated events are added.
 */
export type ServerPacket =
  | ChunkDataPacket
  | PlayerJoinPacket
  | PlayerMovePacket
  | PlayerLeavePacket
  | BlockEditPacket
  | WorldStatePacket;

