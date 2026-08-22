# Voxelia — Game Design Document (GDD)

> **Design Specification: Mechanics, World, Progression, UI/UX & Art**  
> **Version**: 1.0.0  
> **Status**: Active Design Contract  

---

## 1. Core Gameplay Loop

```
         ┌───────────────┐
         │ 1. EXPLORE    │ ───► Discover new biomes, caves, and GLB landmarks
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ 2. HARVEST    │ ───► Mine voxel blocks & gather environmental resources
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ 3. CRAFT      │ ───► Combine materials in 2x2 & 3x3 grids to unlock tools
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ 4. BUILD      │ ───► Shape the voxel world & construct shelter/fortresses
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ 5. SURVIVE    │ ───► Defend against night hostiles, Ghasts, and the Warden
         └───────┬───────┘
                 │
                 └────────────► (Returns to Explore & Expand)
```

---

## 2. World & Biome Design

The world is procedurally generated using 2D and 3D simplex noise modulated by a temperature-moisture biome map:

```
          Cold (Moisture Low)                     Cold (Moisture High)
           [SNOWY MOUNTAINS]                          [TEMPLE RUINS]
                  │                                         │
                  ▼                                         ▼
            [PLAINS] ◄────────────────────────────────► [FOREST]
                  ▲                                         ▲
                  │                                         │
           Warm (Moisture Low)                     Warm (Moisture High)
               [DESERT]                                  [SWAMP]
```

### 2.1 Biome Catalog

| Biome | Surface Voxel | Subsurface | Foliage / Props | Hostile Night Spawns |
|---|---|---|---|---|
| **Plains** | Grass Block | Dirt / Stone | Wild grass, occasional trees | Enderman |
| **Forest** | Grass Block | Dirt | Dense Oak Trees (`minecraft_tree.glb`) | Fox (Day), Enderman |
| **Desert** | Sand | Sandstone / Stone | Cacti, Sand dunes | Enderman |
| **Snowy Mountains**| Snow Block | Stone / Ice | High elevation peaks, snow | Ghast, Enderman |
| **Swamp** | Muddy Grass | Clay / Dirt | Shallow water pools, vines | Warden (Deep), Ghast |
| **Temple Ruins** | Cobblestone / Moss | Stone | Ancient Greek Temple (`greek_temple_scan.glb`) | Warden, Enderman |

---

## 3. The Hybrid "Terrain Anchor" Mechanic

One of Voxelia's signature features is the **Terrain Anchor**:
- At coordinate $(0, 0, 0)$, the game engine places the hand-modeled set piece `free_dirt_road_through_forest.glb`.
- The engine computes the exact Axis-Aligned Bounding Box (AABB) of the model.
- Surrounding procedural voxel chunks automatically conform their ground elevation flush to the model's base elevation ($Y = \text{baseY}$), suppressing procedural voxel generation within the anchor's volume.
- **Outcome**: A cinematic, high-detail starter area with paved dirt paths, lush trees, and terrain props that seamlessly transitions into an infinite voxel sandbox.

---

## 4. Block Matrix & Material Properties

| Block ID | Name | Hardness | Tool Class | Opacity | Physics Solid |
|---|---|---|---|---|---|
| `0` | **Air** | $0.0$ | None | Transparent | No |
| `1` | **Grass Block** | $0.6\text{ s}$ | Shovel / Hand | Opaque | Yes |
| `2` | **Dirt** | $0.5\text{ s}$ | Shovel / Hand | Opaque | Yes |
| `3` | **Stone** | $1.5\text{ s}$ | Pickaxe | Opaque | Yes |
| `4` | **Cobblestone** | $2.0\text{ s}$ | Pickaxe | Opaque | Yes |
| `5` | **Wood Log** | $2.0\text{ s}$ | Axe / Hand | Opaque | Yes |
| `6` | **Planks** | $1.0\text{ s}$ | Axe / Hand | Opaque | Yes |
| `7` | **Leaves** | $0.2\text{ s}$ | Shears / Hand | Semi-transparent | Yes |
| `8` | **Sand** | $0.5\text{ s}$ | Shovel / Hand | Opaque | Yes |
| `9` | **Water** | $\infty$ | None | Transparent (Fluid) | No (Viscous) |
| `10` | **Glass** | $0.3\text{ s}$ | Hand | Transparent | Yes |
| `11` | **Diamond Ore** | $3.0\text{ s}$ | Iron/Diamond Pick | Opaque | Yes |
| `12` | **Torch** | $0.0\text{ s}$ | Hand | Transparent | No (Light) |
| `13` | **Snow** | $0.2\text{ s}$ | Shovel / Hand | Opaque | Yes |

---

## 5. Crafting Progression & Recipe Tree

```
  [Wood Log]
      │
      ▼ (1x1 Craft)
  [4x Wood Planks] ─────────► [2x2 Craft] ───► [1x Crafting Table]
      │                                                │
      ▼ (Vertical 1x2)                                 ▼
  [4x Sticks]                             (Enables 3x3 Grid Workbench)
      │                                                │
      ├───────────────────────┬────────────────────────┤
      │                       │                        │
      ▼ (Sticks + Planks)     ▼ (Sticks + Cobble)      ▼ (Sticks + Diamond)
  [Wooden Pickaxe]        [Stone Pickaxe]          [Diamond Sword]
```

### 5.1 Key Recipes
1. **4x Planks**: $1 \times \text{Wood Log}$
2. **1x Crafting Table**: $4 \times \text{Planks}$ ($2 \times 2$ grid)
3. **4x Torches**: $1 \times \text{Coal/Wood} + 1 \times \text{Stick}$
4. **1x Diamond Sword**: $2 \times \text{Diamond} + 1 \times \text{Stick}$ (Vertical 3x3)
5. **1x Storage Chest**: $8 \times \text{Planks}$ (Hollow 3x3 ring)

---

## 6. Entity & Mob AI Specifications

```
                     ┌──────────────┐
                     │     SPAWN    │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
       ┌────────────►│     IDLE     │◄────────────┐
       │             └──────┬───────┘             │
       │                    │ (Timer)             │ (Target Lost)
       │                    ▼                     │
       │             ┌──────────────┐             │
       │             │    WANDER    │             │
       │             └──────┬───────┘             │
       │                    │                     │
       │     (Player Near)  │  (Player Near)      │
(Calm) │      [Passive]     │   [Hostile]         │
       │           ┌────────┴────────┐            │
       │           ▼                 ▼            │
       │    ┌──────────────┐  ┌──────────────┐    │
       └────┤     FLEE     │  │    CHASE     │────┘
            └──────────────┘  └──────┬───────┘
                                     │ (In Range)
                                     ▼
                              ┌──────────────┐
                              │    ATTACK    │
                              └──────────────┘
```

1. **Fox (`fox_minecraft.glb`)**: Passive wildlife. Wanders naturally; executes high-speed `flee` when player enters within $8\text{ meters}$.
2. **Enderman (`enderman_minecraft_sonic_racing_crossworlds.glb`)**: Neutral until targeted by crosshair. Teleports within $2\text{ meters}$ behind player and initiates high-damage melee attack.
3. **Ghast (`ghast_minecraft_sonic_racing_crossworlds.glb`)**: Spawns at high altitude ($Y > 70$). Hovers smoothly and launches explosive ballistic fireballs when player enters within $30\text{ meters}$.
4. **Warden (`minecraft_warden.glb`)**: Subterranean/Ruins boss. Blind entity that detects sound vibrations (sprinting, block breaking) within $20\text{ meters}$.

---

## 7. User Interface (UI) & HUD Design

- **Crosshair**: Minimalist semi-transparent white '+' in the center of the viewport. Inverts contrast over bright sky or snow.
- **Hotbar**: 9 horizontal slots ($48\text{px} \times 48\text{px}$) docked at bottom center with gold border highlight on active slot (keys 1–9 or mouse scroll).
- **Inventory Screen (`E` key)**: Displays 27 main inventory slots, 9 hotbar slots, 2x2 crafting grid, craft output slot, and armor equipment slots.
- **Workbench Modal**: Activated on right-clicking `bench_minecraft.glb`. Expands to a full 3x3 crafting grid with automatic recipe preview.
- **Debug Telemetry (`F3` key)**: Top-left overlay showing FPS, Camera XYZ, Chunk CX/CZ, Biome, and Memory usage.
