# Voxelia — Browser-Based Voxel Sandbox Blueprint

> **Status**: Phase 1 – World Foundation  
> **Last updated**: 2026-07-01  
> **Version**: 1.0.0

---

## 1. Vision

A persistent, wide open-world voxel sandbox playable in a browser with no install.
Procedurally generated terrain is anchored around a hand-modeled GLB set piece.
Real mob AI, crafting, building, and smooth co-op multiplayer.

---

## 2. Technology Stack

| Layer | Tool | Purpose |
|---|---|---|
| Build | Vite | Fast dev server + optimized production bundling |
| Language | TypeScript (strict) | Shared types across client, server, and shared packages |
| Rendering | Three.js | WebGL2 scene graph, GLTFLoader, AnimationMixer, PointerLockControls |
| UI | Vue 3 | HUD, inventory, hotbar, crafting menu, death screen, lobby UI |
| Realtime | Socket.IO | Authoritative multiplayer state sync and chat |
| Persistence | SQLite (better-sqlite3) | Player accounts, inventories, world save state |
| Physics | Custom AABB | Voxel-aware broad + narrow phase collision |
| Terrain | simplex-noise | 2D/3D noise for heightmaps, caves, biomes |
| Collision accel | three-mesh-bvh | Fast raycasts for block interaction and GLB meshes |
| Pathfinding | A* on voxel grid | Mob navigation with dynamic obstacle replanning |

---

## 3. Monorepo Structure

```
voxelia/
├── package.json              # npm workspaces root
├── turbo.json                # optional task runner
├── .gitignore
├── README.md
├── MINECRAFT_BROWSER_REPLICA_BLUEPRINT.md
│
├── client/                   # Vite + TS + Three.js + Vue 3
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── engine/
│       │   ├── Renderer.ts
│       │   ├── ChunkManager.ts
│       │   ├── AssetLoader.ts
│       │   └── InputController.ts
│       ├── game/
│       │   ├── PlayerController.ts
│       │   ├── Inventory.ts
│       │   └── MobRenderer.ts
│       ├── net/
│       │   └── SocketClient.ts
│       └── ui/
│           ├── App.vue
│           ├── Hud.vue
│           ├── CraftingMenu.vue
│           └── InventoryScreen.vue
│
├── server/                   # Node.js authoritative game server
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── world/
│   │   │   ├── ChunkGenerator.ts
│   │   │   └── WorldStore.ts
│   │   ├── entities/
│   │   │   ├── MobManager.ts
│   │   │   └── PhysicsEngine.ts
│   │   ├── net/
│   │   │   └── SocketHandlers.ts
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   └── db.ts
│   │   └── game/
│   │       └── (crafting, combat)
│   └── tsconfig.json
│
├── shared/                   # Types + constants + utils
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── types/
│   │   │   ├── Block.ts
│   │   │   └── NetPackets.ts
│   │   ├── constants/
│   │   │   └── WorldGenConfig.ts
│   │   └── utils/
│   │       └── AABB.ts
│   └── tsconfig.json
│
└── assets/                   # Source GLBs, textures, audio
    └── models/               # 15 .glb files
```

---

## 4. Asset Manifest

| # | Source File | Alias | Category | Gameplay Role |
|---|---|---|---|---|
| 1 | `fox_minecraft.glb` | Fox | mob | Passive wildlife — wanders, flees on approach |
| 2 | `enderman_minecraft_sonic_racing_crossworlds.glb` | Enderman | mob | Rare hostile — short-range teleport attack |
| 3 | `ghast_minecraft_sonic_racing_crossworlds.glb` | Ghast | mob | Flying hostile — fires slow arching projectiles |
| 4 | `minecraft_warden.glb` | Warden | mob | Heavy boss — triggered by sound, not sight |
| 5 | `minecraft_diamond-sword.glb` | Diamond Sword | weapon | Primary melee — combo swing arc |
| 6 | `minecraft_matchlock.glb` | Matchlock | weapon | Ranged — reload delay, projectile travel |
| 7 | `minecraft_tree.glb` | Tree | environment | Harvestable wood — scattered in forest biomes |
| 8 | `free_dirt_road_through_forest.glb` | Terrain Anchor | terrain_anchor | Fixed origin landmark — chunks generate around it |
| 9 | *(not available — see note)* | — | terrain_tile | **Dropped**: only 15 GLBs exist; anchor serves as sole terrain piece |
| 10 | `minecraft_chest.glb` | Chest | interactive | Placeable storage — grid inventory UI |
| 11 | `bench_minecraft.glb` | Crafting Table | interactive | Crafting station — unlocks full recipe list |
| 12 | `bed_minecraft.glb` | Bed | interactive | Sets respawn point, skips to day |
| 13 | `minecraft_torch.glb` | Torch | interactive | Placeable light — dynamic point light, limited fuel |
| 14 | `harley_styled_motorcycle_-_minecraft.glb` | Motorcycle | vehicle | Rideable fast transport — own physics body |
| 15 | `greek_temple_scan.glb` | Greek Temple | structure | Rare landmark — mini dungeon with loot |
| 16 | `figure_embodying_selene_-_the_moon_goddess.glb` | Selene Figure | decor | Collectible shrine — light end-game quest |

> **Assumption**: Asset #9 (`forest_road_terrain.glb`) does not exist in the repository. The dirt-road anchor model (asset #8) will serve as the sole hand-authored terrain piece. All procedural terrain extends outward from its bounding box.

---

## 5. World Generation Rules

### 5.1 Anchor Rule
`free_dirt_road_through_forest.glb` is loaded **once** at world origin (0, 0, 0) as a static, non-regenerating landmark. All procedural chunk generation extends outward from its bounding box edges without overwriting it.

### 5.2 Heightmap
2D simplex noise with multiple octaves and domain warping for natural hills and valleys.

### 5.3 Biomes
Noise-based temperature × moisture maps blended to choose:
- Surface block type (grass, sand, snow, stone)
- Tree density
- Mob spawn tables

### 5.4 Chunking
- 16 × 16 × 256 columns
- Greedy meshing per chunk per material
- Chunks streamed in/out based on render distance and player position

### 5.5 Caves
3D simplex noise threshold carving beneath a configurable depth.

### 5.6 LOD
Distant chunks render as simplified low-poly meshes with fog blending to hide the horizon seam.

---

## 6. Physics & Math

| System | Implementation |
|---|---|
| Collision broad phase | Spatial hash of nearby chunks |
| Collision narrow phase | AABB-vs-voxel sweep; `three-mesh-bvh` for GLB props |
| Movement integration | Semi-implicit Euler, fixed timestep server tick decoupled from render FPS |
| Gravity | Constant downward accel, capped terminal velocity, reduced while swimming |
| Jump | Single upward velocity impulse, gated by grounded check |
| Projectiles | Velocity + gravity per tick; raycast against AABB + mesh colliders |
| Block interaction | Camera-forward BVH-accelerated raycast, break/place first voxel in reach |
| Day/night cycle | Sun angle = sin(worldTime), ambient + fog interpolated |
| Mob navigation | A* over coarse voxel grid, arrival steering for smooth movement |

---

## 7. Development Phases

### Phase 1 — World Foundation (Week 1)
**Focus**: Chunk system and terrain generation  
**Deliverable**: Anchor GLB loaded + procedural chunks streaming around it

- Set up monorepo (npm workspaces, TypeScript, Vite)
- Define shared block types and world-gen constants
- Implement simplex-noise chunk generator (server)
- Implement greedy mesh builder (client)
- Load anchor GLB at origin
- Stream chunks in/out around camera position
- Basic orbit/fly camera for testing

### Phase 2 — Player Controller (Week 2)
**Focus**: First-person movement, camera, input  
**Deliverable**: Pointer-lock camera with walk, run, jump, crouch, swim

- PointerLockControls integration
- Keyboard input mapping (WASD, Space, Shift, Ctrl)
- Client-side movement prediction
- Sprint, crouch, swim state machines
- Camera head-bob and FOV effects

### Phase 3 — Voxel Physics (Week 3)
**Focus**: AABB collision and block interaction  
**Deliverable**: Player collides with terrain; can place/break blocks

- AABB collision detection and response
- Swept AABB for continuous collision
- Block breaking (raycast → remove voxel → remesh chunk)
- Block placing (raycast → add voxel to adjacent face)
- Gravity and ground detection

### Phase 4 — GLB Asset Integration (Week 4)
**Focus**: Loading and placing all 15 models  
**Deliverable**: Every asset spawns in-world with correct scale and collider

- GLTFLoader wrapper with caching
- Per-asset scale, offset, and collider configuration
- BVH generation for complex meshes
- Procedural placement rules (trees in forests, temples rare, etc.)
- Anchor terrain collision mesh

### Phase 5 — Mob AI (Week 5)
**Focus**: Pathfinding and behavior states  
**Deliverable**: Fox, Enderman, Ghast, Warden each behave distinctly

- A* pathfinding on voxel grid
- Behavior state machine (idle, wander, chase, flee, attack)
- Fox: passive, wander, flee on approach
- Enderman: rare, teleport attack
- Ghast: flying, fires projectiles
- Warden: sound-triggered, heavy attacks
- AnimationMixer for mob animations

### Phase 6 — Combat & Tools (Week 6)
**Focus**: Melee, ranged, durability  
**Deliverable**: Sword and matchlock both function with correct timing and damage

- Melee swing arc with hitbox
- Ranged projectile with travel time
- Damage calculation and health system
- Tool durability
- Death and respawn flow

### Phase 7 — Crafting & Inventory (Week 7)
**Focus**: Recipes, hotbar, storage  
**Deliverable**: Crafting table and chest fully usable end-to-end

- Inventory grid with drag-and-drop
- Hotbar with number-key selection
- Crafting recipe system
- Chest interaction (shared inventory UI)
- Item stack splitting and merging

### Phase 8 — Multiplayer Networking (Week 8)
**Focus**: Authoritative server and sync  
**Deliverable**: Two clients see each other move, break, and place blocks in real time

- Socket.IO event protocol (join, move, break, place, chat, combat)
- Server-authoritative state
- Client-side prediction and reconciliation
- Entity interpolation for remote players
- Chat system

### Phase 9 — Audio & Atmosphere (Week 9)
**Focus**: Ambient sound, day/night, polish  
**Deliverable**: Footsteps, mob sounds, day/night lighting cycle

- Positional audio (Web Audio API)
- Footstep sounds per surface type
- Mob ambient and attack sounds
- Day/night cycle (sun rotation, ambient color, fog)
- Skybox transitions
- Particle effects (block break, torch flame)

### Phase 10 — Persistence & Beta Polish (Week 10)
**Focus**: SQLite save/load and bug pass  
**Deliverable**: Player logs out and returns to same saved world state

- SQLite schema (players, inventories, chunks)
- Save world state on server shutdown
- Load world state on server start
- Player authentication (simple token)
- Bug fixing and performance optimization
- Deployment to Vercel + Railway

---

## 8. Deployment

| Component | Provider | Config |
|---|---|---|
| Client | Vercel | Root dir: `client`, preset: Vite, output: `dist` |
| Server | Railway | Root dir: `server`, persistent volume for SQLite |
| Domain | Custom | `play.domain.com` → Vercel, `ws.domain.com` → Railway |
| CI | GitHub Actions | Typecheck + build on push, block merge on failure |

---

## 9. Acceptance Criteria

1. ✅ Fresh clone runs with documented two-command setup
2. ✅ World explorable beyond anchor with no seams or missing chunks
3. ✅ All 15 GLB assets appear in assigned gameplay roles with colliders
4. ✅ Two browser tabs see each other's movement and block edits in real time
5. ✅ Deployed build matches local behavior with no console errors
6. ✅ Player inventory and world edits persist across server restart

---

## 10. Assumptions & Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-01 | Asset #9 (`forest_road_terrain.glb`) dropped from manifest | File does not exist; anchor model serves as sole hand-authored terrain |
| 2026-07-01 | Chunk height set to 256 blocks | Matches Minecraft convention; sufficient for terrain + caves |
| 2026-07-01 | Fixed timestep = 50ms (20 TPS) | Standard for authoritative game servers |
| 2026-07-01 | Render distance = 8 chunks default | Balance between visual range and WebGL2 performance |
