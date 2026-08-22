# Voxelia — Engineering Rules & Standards

> **Guidelines, Coding Standards, Performance Invariants, and Architecture Rules**  
> **Target**: All Engineers & AI Pair Programmers  

---

## 1. Core Engineering Principles

1. **Ponytail Rule (Zero Speculative Bloat)**: Write only what is immediately required by the Blueprint and Phase deliverables. Never create speculative generic frameworks, unused interfaces, or deep inheritance hierarchies.
2. **Deterministic & Strict**: All code must pass `npm run typecheck` (`tsc --noEmit` and `vue-tsc --noEmit`) with **zero errors and zero warnings**.
3. **Decoupled & Non-Blocking**: Heavy asynchronous operations (GLB model downloads, socket handshakes, disk I/O) must **never** block the render loop or delay initial frame presentation.
4. **Resilient Defaults**: When optional external systems fail (e.g. offline multiplayer server, browser audio autoplay restrictions, missing optional props), fallback gracefully with clean logs without crashing the engine.

---

## 2. Monorepo & Module Boundaries

```
[ shared ] <────── (pure logic, types, zero DOM/Node deps)
    ▲
    │ imports
┌───┴──────────┐
│              │
[ client ]   [ server ]
```

- **Rule 2.1**: `@voxelia/shared` must NEVER import from `@voxelia/client` or `@voxelia/server`. It must have zero browser-specific (`window`, `document`) or Node-specific (`fs`, `net`) code.
- **Rule 2.2**: `@voxelia/client` must NEVER import from `@voxelia/server` and vice versa. Cross-boundary interaction occurs strictly over serialized network packets (`NetPackets.ts`).
- **Rule 2.3**: Common game formulas, block IDs, item definitions, and world gen configurations MUST live in `@voxelia/shared` to guarantee 100% synchronization between client and server.

---

## 3. Strict TypeScript Standards

- **Rule 3.1 — No `any`**: The use of `any` is strictly prohibited in production engine code. Use `unknown`, explicit generics, or discriminated unions.
- **Rule 3.2 — Explicit Return Types**: All exported functions, engine subsystem methods, and public API interfaces must define explicit return types.
- **Rule 3.3 — Readonly by Default**: Interface properties representing immutable configuration (e.g. recipes, block definitions, packet headers) must be marked `readonly`.
- **Rule 3.4 — Strict Null Checks**: Always handle `null` and `undefined` branches explicitly. Do not use non-null assertions (`!`) unless backed by an explicit invariant guard.

---

## 4. WebGL2 & Three.js Performance Invariants

Voxel engines demand intense memory and garbage collection discipline to maintain 60 FPS:

### 4.1 Zero Per-Frame Heap Allocations
- **Rule 4.1.1 — Vector & Matrix Reuse**: NEVER instantiate `new Vector3()`, `new Box3()`, `new Euler()`, or `new Color()` inside `update()`, `render()`, `raycast()`, or physics collision loops. Allocate reusable temporary instances at the module or class instance level.
- **Rule 4.1.2 — Object Pooling**: Transient visual entities (debris particles, temporary bullet tracers) must use pre-allocated object pools (`ParticleSystem.ts`).

### 4.2 Explicit GPU Memory Disposal
- **Rule 4.2.1 — Geometry Disposal**: Whenever a chunk mesh is rebuilt or unloaded, call `geometry.dispose()` on the old `BufferGeometry` before deleting references.
- **Rule 4.2.2 — Material Sharing**: All solid voxel chunks must share a single `MeshLambertMaterial` bound to the global `TextureAtlas`. Never allocate a new material per chunk.

### 4.3 Meshing & Streaming
- **Rule 4.3.1 — Frame Throttling**: Never mesh more than `MAX_CHUNKS_PER_FRAME = 3` solid chunks in a single frame.
- **Rule 4.3.2 — Nearest-First Spiral**: Candidate chunk generation must always iterate through the precomputed `SPIRAL_OFFSETS` table sorted by distance from the player to guarantee instant foot-level terrain generation.

---

## 5. Audio & Asset Standards

- **Rule 5.1 — Git LFS Requirement**: All 3D `.glb` binary assets in `client/public/assets/models/` must be tracked with Git LFS (`.gitattributes`). Never commit raw binary `.glb` files into Git's regular object store.
- **Rule 5.2 — Procedural Sound Synthesis**: SFX must be generated procedurally via the browser Web Audio API. Never rely on external WAV/MP3 files for core sound effects.
- **Rule 5.3 — Autoplay Policy Compliance**: Initialize and resume `AudioContext` only on the first user interaction event (click, keypress) and wrap resume promises in `.catch()` handlers.

---

## 6. Networking & Multiplayer Rules

- **Rule 6.1 — Authoritative Server**: The server has final authority over block state, entity health, and valid placement distances.
- **Rule 6.2 — Optimistic Client Execution**: The client applies local block edits and physics immediately for 0-latency feel, reconciling when server corrections arrive.
- **Rule 6.3 — Offline Resilience**: The client network manager must catch `connect_error` events and allow the player to enjoy uninterrupted single-player sandbox gameplay if the server is unreachable.

---

## 7. Git & CI/CD Hygiene

1. **Clean Workspaces**: Never commit temporary SQLite journals (`*.db-shm`, `*.db-wal`) or build caches (`.tsbuildinfo`, `dist/`).
2. **Commit Messages**: Follow standard conventional commits format:
   - `feat: ...` for new gameplay mechanics
   - `fix: ...` for bug and regression fixes
   - `perf: ...` for optimizations
   - `refactor: ...` for structural cleanup
3. **Verification Command**: Before committing or pushing, verify the full stack builds cleanly:
   ```bash
   npm run typecheck
   npm run build
   ```
