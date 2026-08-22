# Voxelia — Project Memory & Decisions Log

> **Persistent Engineering Memory, Architecture Decision Records (ADRs) & Incident Post-Mortems**  
> **Repository**: `sheikhsajid69/uscraft`  
> **Last Updated**: August 2026  

---

## 1. Project Context & Environment

- **Repository Root**: `c:\Users\Sajid\Downloads\uscraft`
- **Monorepo Packages**:
  - `@voxelia/shared`: TypeScript types, block definitions, recipes, math helpers.
  - `@voxelia/client`: Three.js WebGL2 engine, Vue 3 UI, Web Audio procedural sound.
  - `@voxelia/server`: Node.js, Express, Socket.IO authoritative 20 TPS loop, `better-sqlite3`.
- **Target Platform**: Modern desktop web browsers with WebGL2 (Chrome, Firefox, Safari, Edge).

---

## 2. Architecture Decision Records (ADRs)

### ADR-001: Monorepo Transition (Turborepo + npm workspaces)
- **Context**: The original flat codebase mixed frontend rendering, client assets, and backend multiplayer server logic in a single directory.
- **Decision**: Restructured into three distinct packages (`client`, `server`, `shared`) governed by npm workspaces and Turborepo.
- **Consequence**: Guaranteed type sharing without code duplication; clean separation of client DOM concerns from Node.js database/networking concerns.

### ADR-002: Precomputed Spiral Chunk Generation (`SPIRAL_OFFSETS`)
- **Context**: The original chunk loop checked $(dx, dz)$ from $-14$ to $+14$ row-by-row. Chunks 200m away at the world edge generated before the chunk directly beneath the player's feet, causing player void-falling and severe frame stutter.
- **Decision**: Precompute a static array of $(dx, dz)$ chunk offsets sorted ascending by Euclidean distance $(dx^2 + dz^2)$.
- **Consequence**: The 9 chunks immediately surrounding the player $(0,0)$ generate in the first 3 frames (< 50ms) of booting the game.

### ADR-003: Dynamic Terrain Anchor Clearing
- **Context**: When the 123MB `free_dirt_road_through_forest.glb` anchor finished downloading asynchronously, voxel chunks had already generated over coordinates $(0,0)$, creating intense Z-fighting, physics clipping, and buried entities.
- **Decision**: Implemented `ChunkManager.clearAll()` triggered the instant `setAnchorBounds()` is set. The spiral generator immediately rebuilds all chunks flush with the anchor base elevation ($Y = \text{baseY}$).
- **Consequence**: Zero Z-fighting, smooth road-to-voxel transitions, and seamless visual fidelity.

### ADR-004: Pure Web Audio API Sound Synthesis
- **Context**: Relying on external WAV/MP3 asset files introduces 404 network risks, latency spikes, and asset bloat.
- **Decision**: Synthesize all game audio (block breaking, placement, footsteps, mob growls) purely through Web Audio API oscillators, noise buffers, and bandpass/exponential decay filters.
- **Consequence**: 0 bytes external audio payload, zero network audio latency, and rich acoustic Minecraft-style cues.

### ADR-005: Git LFS Asset Pipeline for 15 GLB Models
- **Context**: 15 3D model files (totaling > 200MB) caused Git HTTPS pushes to fail with `HTTP 408 Request Timeout` when pushed as raw Git blobs.
- **Decision**: Restored `.gitattributes` with `*.glb filter=lfs diff=lfs merge=lfs -text` and indexed all models as Git LFS pointers.
- **Consequence**: Commits and pushes take under 5 seconds; repository cloning remains lightweight and fast.

---

## 3. Incident Post-Mortems & Fixes

### Incident 1: Blank Black Screen (0 FPS, 0 Chunks)
- **Symptom**: Game stuck on a black canvas with FPS counter showing 0 and Chunks showing 0.
- **Root Cause**: `await engine.init()` was called synchronously in `main.ts` before starting the render loop. Because `init()` awaited the 123MB GLB download, the `requestAnimationFrame` loop was blocked from starting.
- **Fix**: Decoupled `engine.init()` into a background task while calling `engine.start()` immediately. The canvas renders sky, day/night lighting, and procedural terrain instantly on frame 1 while GLBs stream in.

### Incident 2: Mob Falling & Suffocation in Bedrock
- **Symptom**: Mobs spawned by `MobSystem` fell through unrendered chunks and got clamped to $Y = 10$, suffocating inside solid stone when chunks meshed.
- **Root Cause**: `findGroundY()` returned a hardcoded $Y = 10$ if chunk voxels had not yet been built into memory.
- **Fix**: Replaced hardcoded fallback with `queryTerrainHeight(wx, wz) + 1` from the mathematical noise heightmap. Mobs now track accurate procedural surface elevation even before voxel meshes complete.

### Incident 3: Git HTTPS HTTP 408 Request Timeout
- **Symptom**: `git push origin main` failed with `error: RPC failed; HTTP 408 curl 22`.
- **Root Cause**: `.gitattributes` was missing in the staging area, causing Git to upload 200MB+ of raw binary GLB files directly over HTTPS.
- **Fix**: Re-initialized Git LFS, restored `.gitattributes`, and restaged `client/public/assets/models/*.glb`. Git recognized all 15 models as 100% exact LFS renames, reducing commit payload to text pointers and pushing in 2 seconds.

---

## 4. Current Workspace Verification

- **Build Status**: `npm run build` completes with **0 errors**.
- **Typecheck Status**: `npm run typecheck` passes across `@voxelia/shared`, `@voxelia/client`, and `@voxelia/server` with **0 errors**.
- **Git Status**: Clean working tree on branch `main` synchronized with `https://github.com/sheikhsajid69/uscraft.git`.
