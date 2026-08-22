# Voxelia — Development Roadmap & Phases

> **Phase Tracking & Milestone Execution Document**  
> **Source of Truth**: `MINECRAFT_BROWSER_REPLICA_BLUEPRINT.md`  
> **Current Version**: 1.0.0  

---

## Roadmap Overview

```
[Phase 1: World Foundation]          ✅ Completed & Performance Optimized
[Phase 2: Player Controller]         ✅ Completed & Integrated
[Phase 3: Voxel Physics]             ✅ Completed & Integrated
[Phase 4: GLB Asset Integration]     🔄 In Progress (Anchor + Base Props Active)
[Phase 5: Mob AI & Entities]         🔄 In Progress (State Machine & Terrain Snapping)
[Phase 6: Combat & Tools]            ⏳ Up Next
[Phase 7: Crafting & Inventory]      🔄 In Progress (Recipes & UI Store Active)
[Phase 8: Multiplayer Networking]    🔄 In Progress (Socket Layer & Delta Sync)
[Phase 9: Audio & Atmosphere]        🔄 In Progress (Web Audio Synthesizers Shipped)
[Phase 10: Persistence & Beta]       🔄 In Progress (SQLite Backend Active)
```

---

## Detailed Phase Breakdown

### Phase 1 — World Foundation
- **Goal**: Establish the monorepo, 3D voxel engine, procedural noise generation, texture atlas, and chunk streaming around the origin anchor.
- **Deliverables**:
  - [x] Monorepo restructuring (`client`, `server`, `shared`) with Turborepo and Vite.
  - [x] Simplex/Perlin noise terrain generator with multi-biome classification (Plains, Forest, Desert, Snowy Mountains, Swamp, Temple Ruins).
  - [x] Greedy/Ambient-Occlusion chunk mesher with dynamic water buffer meshing.
  - [x] Precomputed spiral nearest-first chunk streaming algorithm (`SPIRAL_OFFSETS`).
  - [x] Procedural HTML5 canvas 16-block `TextureAtlas`.
  - [x] Seamless terrain anchor embedding (`free_dirt_road_through_forest.glb`) with automatic chunk flush to prevent Z-fighting.
- **Status**: **Completed & Stabilized**

---

### Phase 2 — Player Controller & Movement
- **Goal**: Full first-person immersive movement controls, gravity, jump, swimming, and camera views.
- **Deliverables**:
  - [x] PointerLockControls mouse-look with yaw/pitch clamping.
  - [x] WASD movement with dynamic speed states (Walk $4.3\text{ m/s}$, Sprint $5.6\text{ m/s}$, Crouch $1.29\text{ m/s}$).
  - [x] Jump physics ($8.5\text{ m/s}$ impulse) with strict grounded validation.
  - [x] Fluid swimming physics (buoyancy, gravity damping, viscous drag) below sea level ($Y < 32$).
  - [x] First-person sinusoidal head-bobbing and dynamic sprint FOV expansion.
  - [x] Third-person orbit spring-arm camera (`F5` key) with terrain collision avoidance.
- **Status**: **Completed & Stabilized**

---

### Phase 3 — Voxel Physics & Block Interaction
- **Goal**: Fast continuous collision detection, DDA raycasting, block harvesting, block placement, and particle feedback.
- **Deliverables**:
  - [x] 3D DDA voxel raycaster up to $5.0\text{ m}$ reach with wireframe selection bounding box.
  - [x] Left-click block breaking with instant chunk remeshing and neighbor-face updates.
  - [x] Right-click block placement against target face normals with player AABB collision prevention.
  - [x] Object-pooled cube debris particle system (`ParticleSystem.ts`) for break and place events.
  - [x] Procedural block break popping sounds and place click sounds.
- **Status**: **Completed & Stabilized**

---

### Phase 4 — GLB Asset Integration & World Landmarks
- **Goal**: Load, scale, place, and collide against all 15 hand-authored GLB models.
- **Deliverables**:
  - [x] `AssetLoader.ts` with GLTF caching and cloning.
  - [x] Git LFS indexing for all 15 `.glb` files.
  - [x] Origin anchor landmark placement (`free_dirt_road_through_forest.glb`).
  - [x] Interactive Crafting Table placement (`bench_minecraft.glb`).
  - [ ] Procedural tree placement (`minecraft_tree.glb`) in Forest biome.
  - [ ] Rare temple dungeon landmark placement (`greek_temple_scan.glb`).
  - [ ] Interactive chest, bed, and torch object placement with BVH colliders.
  - [ ] Rideable motorcycle vehicle entity (`harley_styled_motorcycle_-_minecraft.glb`).
- **Status**: **In Progress**

---

### Phase 5 — Mob AI & Entity Systems
- **Goal**: Multi-archetype mob behavior, pathfinding, and animation.
- **Deliverables**:
  - [x] Entity spawner for 4 mob archetypes: Fox (Passive), Enderman (Teleporter), Ghast (Flying), Warden (Boss).
  - [x] Mathematical procedural terrain height fallback (`queryTerrainHeight`) to prevent underground suffocation.
  - [x] State machines: `idle`, `wander`, `chase`, `flee`.
  - [ ] A* voxel grid pathfinding around obstacles and elevation steps.
  - [ ] Three.js `AnimationMixer` playback for GLB skeletal animations.
  - [ ] Ghast projectile fireball spawning and Enderman teleportation fx.
- **Status**: **In Progress**

---

### Phase 6 — Combat & Tools
- **Goal**: Weapon mechanics, melee hitboxes, ballistic projectiles, tool tiers, and health systems.
- **Deliverables**:
  - [ ] Diamond sword melee swing animation and arc hitbox detection (`minecraft_diamond-sword.glb`).
  - [ ] Matchlock rifle ballistic projectile physics, reload delay, and muzzle flash (`minecraft_matchlock.glb`).
  - [ ] Player health bar, hunger bar, and damage flash overlay.
  - [ ] Tool mining multipliers (Pickaxe vs. Stone, Axe vs. Wood, Shovel vs. Dirt).
  - [ ] Mob health, damage intake, and death drop loot.
- **Status**: **Planned**

---

### Phase 7 — Crafting & Inventory System
- **Goal**: Complete item lifecycle, 2x2 / 3x3 recipe matching, hotbar, and container storage.
- **Deliverables**:
  - [x] Recipe engine (`Recipes.ts`) with pattern normalization and bounding-box matching.
  - [x] Vue 3 reactive Hotbar (9 slots) and main inventory UI (27 slots).
  - [x] Reactive inventory store (`inventoryStore.ts`) with stack counts and item types.
  - [ ] Interactive 3x3 Crafting Table modal when clicking `bench_minecraft.glb`.
  - [ ] Interactive 27-slot Chest storage container modal when clicking `minecraft_chest.glb`.
  - [ ] Drag-and-drop item stack splitting (Right-click = split half, Shift-click = quick transfer).
- **Status**: **In Progress**

---

### Phase 8 — Multiplayer Networking
- **Goal**: Authoritative game server, peer movement interpolation, and real-time world synchronization.
- **Deliverables**:
  - [x] Socket.IO network client with connection resilience and offline fallback.
  - [x] Express + Socket.IO server loop running at 20 TPS.
  - [x] `PlayerMovePacket` and `BlockEditPacket` protocol types in `@voxelia/shared`.
  - [x] Remote peer 3D avatar rendering with position and yaw interpolation.
  - [ ] Server-authoritative proximity and anti-cheat validation on block edits.
  - [ ] Global multiplayer text chat system with timestamps and system alerts.
- **Status**: **In Progress**

---

### Phase 9 — Audio & Atmospheric Immersion
- **Goal**: Dynamic environmental lighting, day/night transitions, and complete audio polish.
- **Deliverables**:
  - [x] Web Audio procedural acoustic synthesizers for footsteps, breaks, places, and growls.
  - [x] Dynamic day/night sun orbit with celestial light color interpolation and distance fog blending.
  - [ ] Dynamic point light shadows from placed torches (`minecraft_torch.glb`).
  - [ ] Positional 3D spatial Web Audio for nearby mobs and ambient wind/water sounds.
- **Status**: **In Progress**

---

### Phase 10 — Persistence & Production Polish
- **Goal**: SQLite persistence for world edits and players, production build optimization, and cloud deployment.
- **Deliverables**:
  - [x] `better-sqlite3` database engine with WAL journal mode.
  - [x] World save table storing modified chunk block arrays.
  - [ ] Player account authentication and persistent inventory saves.
  - [ ] Production build bundles (Vite + TS) verified with zero errors.
  - [ ] Deployment scripts and CI/CD pipelines for Vercel (Client) and Railway (Server).
- **Status**: **In Progress**
