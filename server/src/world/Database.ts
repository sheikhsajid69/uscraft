import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export interface PersistedBlockEdit {
  wx: number;
  wy: number;
  wz: number;
  block_id: number;
}

export interface PersistedPlayerState {
  player_id: string;
  x: number;
  y: number;
  z: number;
  inventory: string;
}

/**
 * SQLite persistence layer using better-sqlite3.
 * Stores player block edits and world mutations across server restarts.
 */
export class WorldDatabase {
  private readonly db: Database.Database;
  private readonly stmtSaveEdit: Database.Statement;
  private readonly stmtDeleteEdit: Database.Statement;
  private readonly stmtLoadAllEdits: Database.Statement;
  private readonly stmtSavePlayer: Database.Statement;
  private readonly stmtLoadPlayer: Database.Statement;

  constructor(dbPath?: string) {
    const file = dbPath ?? path.resolve(process.cwd(), "voxelia.db");
    this.db = new Database(file);

    // Enable WAL mode for performance
    this.db.pragma("journal_mode = WAL");

    this.initSchema();

    this.stmtSaveEdit = this.db.prepare(
      "INSERT OR REPLACE INTO block_edits (wx, wy, wz, block_id) VALUES (?, ?, ?, ?)"
    );
    this.stmtDeleteEdit = this.db.prepare(
      "DELETE FROM block_edits WHERE wx = ? AND wy = ? AND wz = ?"
    );
    this.stmtLoadAllEdits = this.db.prepare(
      "SELECT wx, wy, wz, block_id FROM block_edits"
    );
    this.stmtSavePlayer = this.db.prepare(
      "INSERT OR REPLACE INTO player_state (player_id, x, y, z, inventory) VALUES (?, ?, ?, ?, ?)"
    );
    this.stmtLoadPlayer = this.db.prepare(
      "SELECT player_id, x, y, z, inventory FROM player_state WHERE player_id = ?"
    );
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS block_edits (
        wx INTEGER NOT NULL,
        wy INTEGER NOT NULL,
        wz INTEGER NOT NULL,
        block_id INTEGER NOT NULL,
        PRIMARY KEY (wx, wy, wz)
      );

      CREATE TABLE IF NOT EXISTS player_state (
        player_id TEXT PRIMARY KEY,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL NOT NULL,
        inventory TEXT NOT NULL
      );
    `);
  }

  /** Load all persisted block mutations into a Map keyed by "wx,wy,wz". */
  public loadAllBlockEdits(): Map<string, number> {
    const map = new Map<string, number>();
    const rows = this.stmtLoadAllEdits.all() as PersistedBlockEdit[];
    for (const row of rows) {
      map.set(`${row.wx},${row.wy},${row.wz}`, row.block_id);
    }
    console.log(`[WorldDatabase] Loaded ${map.size} persisted block edits.`);
    return map;
  }

  /** Persist a single block mutation. */
  public saveBlockEdit(wx: number, wy: number, wz: number, blockId: number): void {
    try {
      this.stmtSaveEdit.run(wx, wy, wz, blockId);
    } catch (err) {
      console.error(`[WorldDatabase] Failed to save block edit at (${wx},${wy},${wz}):`, err);
    }
  }

  /** Save player position and inventory JSON string. */
  public savePlayerState(playerId: string, x: number, y: number, z: number, inventory: string): void {
    try {
      this.stmtSavePlayer.run(playerId, x, y, z, inventory);
    } catch (err) {
      console.error(`[WorldDatabase] Failed to save player state for ${playerId}:`, err);
    }
  }

  /** Load player state. */
  public loadPlayerState(playerId: string): PersistedPlayerState | undefined {
    try {
      return this.stmtLoadPlayer.get(playerId) as PersistedPlayerState | undefined;
    } catch (err) {
      console.error(`[WorldDatabase] Failed to load player state for ${playerId}:`, err);
      return undefined;
    }
  }

  public close(): void {
    this.db.close();
  }
}
