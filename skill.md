---
name: uscraft-engine
description: Reference skill for understanding and expanding the USCraft voxel engine architecture
---

# USCraft Voxel Engine Skill

This skill file provides a high-level summary of the architectural patterns used in USCraft to assist in generating new features or debugging.

## Core Loop
The game operates on a fixed-timestep loop (`TICK_RATE = 1/60`). `GameLoop.ts` accumulates delta time to ensure physics run deterministically regardless of framerate.

## Meshing
`ChunkMesher` relies on Greedy Meshing. It sweeps through 3 axes (X, Y, Z), building a 2D mask of visible faces and grouping identical blocks into large quads. Always verify winding orders (`indices`) when modifying this file to prevent backface culling issues.

## Interaction
`PlayerController` utilizes two interaction paradigms:
1. **Voxel DDA Raycast**: Used for breaking/placing grid-based blocks.
2. **Three.js Raycaster**: Used for interacting with non-grid `.glb` meshes (like opening a Chest).
