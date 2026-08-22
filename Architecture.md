# Voxelia — System Architecture

> **Architecture Specification & Component Design**  
> **Version**: 1.0.0  
> **Scope**: Client, Server, Shared Core, Rendering Pipeline, Physics, Networking  

---

## 1. High-Level System Overview

Voxelia uses a **Client-Server-Shared Monorepo Architecture** orchestrated with npm workspaces and Turborepo. The frontend runs in modern browsers with WebGL2 via Three.js and Vue 3, while the backend is an authoritative Node.js game server communicating via WebSockets (Socket.IO) backed by a SQLite database (`better-sqlite3`).

```
                              ┌────────────────────────┐
                              │     @voxelia/shared    │
                              │ (Types, Math, Recipes) │
                              └───────────┬────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
                   ▼                                             ▼
       ┌────────────────────────┐                   ┌────────────────────────┐
       │    @voxelia/client     │                   │    @voxelia/server     │
       │ (Three.js, Vue 3, Net) │◄──── WebSocket ──►│ (Auth Loop, DB, Chunks)│
       └────────────────────────┘    (Socket.IO)    └────────────┬───────────┘
                   │                                             │
                   ▼                                             ▼
       ┌────────────────────────┐                   ┌────────────────────────┐
       │   Browser DOM & Canvas │                   │    SQLite Database     │
       │   (WebGL2, Web Audio)  │                   │ (World & Player State) │
       └────────────────────────┘                   └────────────────────────┘
```

---

## 2. Monorepo Topology & Boundaries

```
uscraft/
├── shared/                      # Pure TypeScript, zero external runtime dependencies
│   ├── src/
│   │   ├── constants/           # WorldGenConfig, Block definitions, Physics constants
│   │   ├── types/               # BlockId, NetPackets, Recipes, Entity interfaces
│   │   └── utils/               # AABB math, ChunkKey hashing, Biome classifiers
│   └── tsconfig.json
│
├── client/                      # Vite + Three.js + Vue 3 Frontend
│   ├── public/assets/models/    # 15 Git-LFS tracked GLB models
│   ├── src/
│   │   ├── engine/              # Three.js Game Loop, ChunkManager, Mesher, Sky, Audio
│   │   ├── ui/                  # Vue 3 reactive overlays (App, Hotbar, Inventory)
│   │   └── main.ts              # Client entrypoint & bootstrap
│   └── vite.config.ts
│
├── server/                      # Node.js + Express + Socket.IO Backend
│   ├── src/
│   │   ├── world/               # ChunkGenerator, WorldStore, SQLite Database adapter
│   │   └── index.ts             # 20 TPS Authoritative game server loop
│   └── tsconfig.json
│
├── turbo.json                   # Build & pipeline orchestration
└── package.json                 # Workspace root definitions
```

### 2.1 Boundary Invariants
1. **Shared is Pure**: `@voxelia/shared` has zero DOM or Node.js native dependencies. It compiles to standard ESM/CommonJS.
2. **Client Never Imports Server**: `@voxelia/client` never imports from `@voxelia/server`. Communication happens strictly through serialized `NetPackets`.
3. **Strict Type Safety**: All packages enforce `strict: true` in `tsconfig.json` with zero allowed `any` in core loops.

---

## 3. Client Architecture

```
                                ┌─────────────────┐
                                │     main.ts     │
                                └────────┬────────┘
                                         │
                                ┌────────▼────────┐
                                │   GameEngine    │
                                └────────┬────────┘
             ┌──────────────┬────────────┼────────────┬──────────────┐
             │              │            │            │              │
             ▼              ▼            ▼            ▼              ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
     │   Renderer   │ │  Chunk   │ │  Player  │ │   Mob    │ │   Network    │
     │  (Three.js,  │ │ Manager  │ │Controller│ │  System  │ │    Client    │
     │ Sky, Shadows)│ │ (Spiral) │ │(Physics) │ │(AI, GLB) │ │ (Socket.IO)  │
     └──────────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘
             │              │            │            │              │
             ▼              ▼            ▼            ▼              ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
     │ TextureAtlas │ │WaterMesh │ │ Block    │ │ Audio    │ │ Particle     │
     │  (Procedural)│ │ (Wave)   │ │ Interact │ │ (WebAudio│ │ System (Pool)│
     └──────────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

### 3.1 Subsystem Specifications

#### 3.1.1 GameEngine (`client/src/engine/GameEngine.ts`)
- **Role**: Master orchestrator running the `requestAnimationFrame` render loop.
- **Decoupled Startup**: Non-blocking boot sequence where rendering and initial player spawning run immediately, while heavy GLB assets (like the 123MB terrain anchor) load asynchronously in the background.

#### 3.1.2 ChunkManager & Meshing (`client/src/engine/ChunkManager.ts`, `ChunkMesher.ts`)
- **Spiral Streaming**: Precomputed static offset table (`SPIRAL_OFFSETS`) sorted by $(dx^2 + dz^2)$ ascending. Chunks closest to the camera generate on frame 1.
- **Throttling**: Strict `MAX_CHUNKS_PER_FRAME = 3` cap to preserve 60 FPS without frame drops during rapid exploration.
- **Ambient Occlusion (AO)**: Per-vertex 4-level AO computed using the standard 3-neighbor solid block heuristic.
- **WaterMesher**: Independent buffer geometry with custom wave animation offsets and transparency blending.

#### 3.1.3 TextureAtlas (`client/src/engine/TextureAtlas.ts`)
- **Procedural Tile Canvas**: Generates a high-performance 16-block procedural texture atlas dynamically at runtime using HTML5 Canvas (Grass, Dirt, Stone, Cobblestone, Wood, Planks, Leaves, Sand, Water, Glass, Diamond, etc.) with `NearestFilter` sampling.

#### 3.1.4 PlayerController & Physics (`client/src/engine/PlayerController.ts`)
- **Input Sampling**: Pointer Lock mouse deltas + raw keyboard keys mapped to directional vectors.
- **Physics Integration**: Semi-implicit Euler integration:
  $$\vec{v}_{t+\Delta t} = \vec{v}_t + \vec{a}\Delta t$$
  $$\vec{x}_{t+\Delta t} = \vec{x}_t + \vec{v}_{t+\Delta t}\Delta t$$
- **Ground & Surface Snapping**: Samples voxel solid boundaries and procedural height fallbacks to prevent clipping.
- **Fluid Damping**: Damps vertical gravity from $-28\text{ m/s}^2$ to $-7\text{ m/s}^2$ with exponential velocity decay when submerged below sea level ($Y < 32$).

#### 3.1.5 MobSystem (`client/src/engine/MobSystem.ts`)
- **Entity Pool**: Manages state machines (`idle`, `wander`, `chase`, `flee`) for 4 distinct mob archetypes.
- **Height Fallback**: Uses `queryTerrainHeight(wx, wz)` fallback if chunk voxels are pending meshing, guaranteeing mobs never fall through ungenerated geometry.

#### 3.1.6 AudioSystem (`client/src/engine/AudioSystem.ts`)
- **Pure Web Audio API**: Procedural sound synthesizers (exponential frequency sweeps, filtered white noise bursts) for block breaking, footsteps, placement, and mob growls.

#### 3.1.7 UI Layer (`client/src/ui/`)
- **Vue 3 Integration**: Reactive HTML/CSS overlay layer bound to reactive game stores (`inventoryStore.ts`, `stats.ts`). Displays Hotbar, 27-slot Inventory, Crafting Grid, and Debug telemetry.

---

## 4. Server Architecture

```
                     ┌──────────────────────────────┐
                     │         Server Index         │
                     │  (Express + Socket.IO Server)│
                     └──────────────┬───────────────┘
                                    │
                     ┌──────────────▼───────────────┐
                     │    Authoritative Loop (20TPS)│
                     │ (Player Tick, World Tick)    │
                     └──────────────┬───────────────┘
                                    │
             ┌──────────────────────┴──────────────────────┐
             │                                             │
             ▼                                             ▼
     ┌───────────────┐                             ┌───────────────┐
     │  WorldStore   │                             │  Database.ts  │
     │(Chunk Deltas) │                             │(SQLite WAL DB)│
     └───────────────┘                             └───────────────┘
```

### 4.1 Authoritative 20 TPS Tick Loop
The server ticks every $50\text{ ms}$:
1. Process incoming client input packets (`PlayerMovePacket`, `BlockEditPacket`).
2. Validate block break/place proximity and validity.
3. Broadcast entity positions and world state deltas to connected peers.
4. Commit block modifications to SQLite WAL journal.

### 4.2 World Persistence (`server/src/world/Database.ts`)
- Utilizes `better-sqlite3` in Write-Ahead Logging (`WAL`) mode for zero-latency concurrent reads and asynchronous disk flushes.
- Table schema stores persistent chunks, block diffs, player accounts, and container inventories.

---

## 5. Network Protocol & Synchronization

Communication occurs over Socket.IO with strongly typed payloads defined in `@voxelia/shared`:

```typescript
// Core Synchronization Packets
export interface PlayerMovePacket {
  playerId: string;
  position: [number, number, number];
  rotation: [number, number]; // [yaw, pitch]
  animState: 'idle' | 'walk' | 'sprint' | 'jump' | 'swim';
}

export interface BlockEditPacket {
  x: number;
  y: number;
  z: number;
  blockId: BlockId; // 0 = AIR (break), >0 = place
}

export interface WorldStatePacket {
  tick: number;
  players: PlayerState[];
  blockEdits: BlockEditPacket[];
}
```

---

## 6. Performance & Memory Strategies

1. **Spiral Nearest-First Meshing**: Solves initial spawn lag and void fall-through.
2. **Object Pooling**: Pre-instantiates particle meshes and reusable Vector3 / Box3 instances to avoid garbage collection stutter.
3. **Geometry Disposal**: When chunks remesh or unload, old `BufferGeometry` attributes are explicitly disposed of.
4. **Git LFS Asset Pipeline**: All 15 `.glb` binary models are managed via Git LFS pointers to keep repository clones light and avoid HTTP timeout failures during deployments.
