# Voxelia — Product Requirements Document (PRD)

> **Document Version**: 1.0.0  
> **Status**: Active / In Progress  
> **Author**: Voxelia Engineering Team  
> **Target Audience**: Core Developers, Designers, QA Engineers  

---

## 1. Executive Summary & Vision

**Voxelia** is an open-world, browser-based voxel sandbox game heavily inspired by classic Minecraft mechanics, built entirely on modern web standards (WebGL2, Three.js, TypeScript, Vue 3, and Node.js/Socket.IO). 

The core vision is **instant, friction-free accessibility**:
- **Zero Install / Zero Plugin**: Playable directly inside any modern web browser across desktop operating systems.
- **Hybrid World Generation**: Combines infinite, multi-biome procedural voxel terrain with hand-authored, high-detail 3D GLB set pieces seamlessly embedded at the origin.
- **Rich Interactive Sandbox**: Complete first-person survival experience featuring dynamic fluid physics, day/night cycles, block harvesting/placement, crafting, tool progression, mob AI, and real-time multiplayer co-op.

---

## 2. Target Audience & Core Value Proposition

- **Target Audience**: Browser gamers, voxel sandbox enthusiasts, educators, and indie game communities looking for instant sandbox gameplay without downloads, launcher installations, or account paywalls.
- **Core Value Proposition**: 
  - Sub-3-second load times into a living voxel world.
  - Smooth 60 FPS performance on standard hardware.
  - Authentic voxel mechanics combined with unique artistic landmarks.

---

## 3. Product Goals & Non-Goals

### 3.1 Goals
- Deliver authentic voxel sandbox mechanics: breaking/placing blocks, physics-based movement, swimming, sprinting, crouching, and inventory management.
- Provide a robust client-server architecture with server-authoritative multiplayer synchronization.
- Seamlessly blend procedural noise-driven voxels with pre-baked GLB models (anchors, landmarks, props, mobs).
- Ensure 100% strict TypeScript type safety and zero-error builds across monorepo packages.

### 3.2 Non-Goals
- Native mobile touch support in MVP (Desktop mouse + keyboard first).
- Complex infinite server clusters in Phase 1 (Single authoritative room/world server initially).
- Microtransactions or pay-to-win mechanics.

---

## 4. Functional Requirements

### 4.1 World & Procedural Generation
- **Chunk Geometry**: Chunks sized at $16 \times 16 \times 256$ blocks.
- **Nearest-First Streaming**: Chunks must stream outward in a precomputed spiral pattern from the player's camera position to guarantee the ground beneath the player spawns on frame 1.
- **Biomes**: Dual-axis noise (Temperature $\times$ Moisture) generating Plains, Forest, Desert, Snowy Mountains, Swamp, and Temple Ruins.
- **Terrain Anchor**: Load `free_dirt_road_through_forest.glb` as a static origin landmark $(0,0,0)$ and conform surrounding procedural voxel chunks to its base elevation with zero Z-fighting or overlap.
- **Caves & Underground**: 3D Perlin/Simplex noise threshold carving below surface elevation.
- **Water & Fluids**: Surface water level at $Y = 32$ with custom water meshing, transparency, and animated wave motion.

### 4.2 Player Controls & Physics
- **First-Person Camera**: Pointer lock mouse controls with pitch/yaw clamping and optional 3rd-person spring-arm camera (`F5`).
- **Movement State Machine**:
  - Walk ($4.3\text{ m/s}$), Sprint ($5.6\text{ m/s}$), Crouch ($1.29\text{ m/s}$ with eye height lower).
  - Jump impulse ($8.5\text{ m/s}$) gated by grounded checks.
  - Gravity ($-28\text{ m/s}^2$) with terminal velocity cap ($-50\text{ m/s}$).
  - Water physics: Reduced downward gravity ($-7\text{ m/s}^2$), viscous damping, and vertical swim impulses.
- **Block Raycasting**: Continuous DDA raycaster up to $5.0\text{ m}$ reach with wireframe selection highlight.

### 4.3 Building & Block Interaction
- **Destruction**: Left-click to break blocks with custom particle debris bursts and Web Audio popping sounds.
- **Placement**: Right-click to place the active hotbar block against the targeted face normal with collision prevention against the player's bounding box.
- **Tool Durability & Mining Speeds**: Appropriate harvest speeds based on equipped tool class (Sword, Pickaxe, Axe, Shovel).

### 4.4 Crafting & Inventory
- **2x2 Player Crafting**: Built-in inventory crafting for basic planks, sticks, torches, and crafting tables.
- **3x3 Workbench Crafting**: Dedicated crafting bench interaction unlocking advanced tool, armor, and block recipes.
- **Hotbar & Inventory UI**: 9-slot quick hotbar + 27-slot main inventory with drag-and-drop, stack splitting, and tooltip inspection.

### 4.5 Mob Entities & AI
- **Fox (Passive)**: Wandering wildlife, detects player proximity, flees when approached.
- **Enderman (Hostile)**: Neutral until looked at; teleports and strikes in melee range.
- **Ghast (Flying Hostile)**: High-altitude hovering entity, fires slow-moving explosive projectile fireballs.
- **Warden (Boss)**: Sound-triggered ground brute with high health and devastating melee blows.
- **Terrain Snapping**: Mobs must dynamically sample surface elevation to prevent underground suffocation or floating.

### 4.6 Multiplayer Networking
- **Real-Time Synchronization**: Authoritative state synchronization at 20 ticks per second (TPS) via Socket.IO.
- **Player Sync**: Position, rotation, animations, equipped items, and health.
- **World Sync**: Real-time broadcast and persistence of block break and place events.
- **Peer Avatars**: Render 3D peer models with position interpolation for smooth remote movement.

### 4.7 Audio & Visual Polish
- **Web Audio Procedural Sound**: Synthesizer-based acoustic effects for footsteps, block breaks, block places, and mob growls with zero external MP3/WAV dependencies.
- **Dynamic Lighting**: Directional sun light, hemisphere ambient light, and distance fog interpolating with the day/night cycle.
- **Particle System**: Object-pooled cube debris particles for block actions.

---

## 5. Non-Functional Requirements

| Metric | Requirement | Justification |
|---|---|---|
| **Target Framerate** | 60 FPS (stable) | Smooth first-person experience |
| **Initial World Load** | < 2.5 seconds | Prevent player bounce / dropout |
| **Render Distance** | Default 14 chunks (configurable 6–20) | Balance draw calls and memory |
| **Memory Footprint** | < 800 MB Client Heap | Avoid browser tab crashes |
| **Network Tickrate** | 20 TPS (50ms interval) | Standard competitive server latency |
| **Browser Compatibility** | Chrome, Edge, Firefox, Safari (WebGL2) | Maximum platform reach |
| **Type Safety** | 100% strict TypeScript (0 errors) | Maintainability & stability |

---

## 6. Asset Manifest & Roles

| # | Asset File | In-Game Alias | Category | Functional Role |
|---|---|---|---|---|
| 1 | `fox_minecraft.glb` | Fox | Mob | Passive wandering wildlife |
| 2 | `enderman_minecraft_sonic_racing_crossworlds.glb` | Enderman | Mob | Teleporting hostile entity |
| 3 | `ghast_minecraft_sonic_racing_crossworlds.glb` | Ghast | Mob | Flying aerial projectile attacker |
| 4 | `minecraft_warden.glb` | Warden | Mob | High-threat boss encounter |
| 5 | `minecraft_diamond-sword.glb` | Diamond Sword | Weapon | Primary melee weapon with swing arc |
| 6 | `minecraft_matchlock.glb` | Matchlock Gun | Weapon | Ranged ballistic weapon |
| 7 | `minecraft_tree.glb` | Oak Tree | Environment | Procedural natural tree prop |
| 8 | `free_dirt_road_through_forest.glb` | Forest Road Anchor | Landmark | Fixed world origin terrain anchor |
| 9 | `minecraft_chest.glb` | Storage Chest | Interactive | Storage container with persistent grid UI |
| 10 | `bench_minecraft.glb` | Crafting Table | Interactive | 3x3 workbench crafting station |
| 11 | `bed_minecraft.glb` | Bed | Interactive | Respawn point anchor & day-skip |
| 12 | `minecraft_torch.glb` | Torch | Interactive | Dynamic point light block |
| 13 | `harley_styled_motorcycle_-_minecraft.glb` | Motorcycle | Vehicle | High-speed rideable vehicle |
| 14 | `greek_temple_scan.glb` | Greek Temple | Structure | Rare landmark dungeon set piece |
| 15 | `figure_embodying_selene_-_the_moon_goddess.glb` | Selene Statue | Decor | Rare collectible altar/shrine |

---

## 7. Success Criteria & Acceptance Gates

1. **Gate 1 — Startup**: Game boots to playable state within 3 seconds, player spawns safely on solid terrain without falling through into the void.
2. **Gate 2 — Core Loop**: Player can mine stone/wood, craft planks/tools in inventory, place blocks, and hear reactive sound effects.
3. **Gate 3 — Anchor Coherence**: The forest road anchor model sits flush with voxel terrain without gaps, floating geometry, or Z-fighting.
4. **Gate 4 — Multiplayer Integrity**: Two separate browser sessions connect to the same server, see each other move smoothly, and observe shared block edits in real time.
5. **Gate 5 — Persistence**: Server shutdown and restart retains all modified chunks, player inventories, and chest contents in SQLite.
