# USCraft Agentic Guidelines

This document provides architectural rules and context for AI agents operating within the USCraft repository.

## 1. Technology Stack
- **Core**: Vite, TypeScript, Node.js
- **Rendering**: Three.js (WebGL2)
- **UI**: Pure HTML/CSS (Vanilla JS DOM manipulation). Avoid introducing React/Vue unless explicitly requested.

## 2. Codebase Philosophy
- **Performance First**: Voxel engines are highly CPU/GPU bound. Maintain the **Greedy Meshing** algorithm in `ChunkMesher.ts`. Do not regress to naive face-culling.
- **Standard Library over Custom**: Utilize Three.js built-ins (e.g., `THREE.Box3`, `THREE.Raycaster`) rather than writing custom math primitives, unless specific voxel algorithms (like DDA) demand it.
- **Decoupled Logic**: 
  - `GameLoop` handles fixed-timestep updates.
  - `ChunkManager` handles data; `ChunkMesher` handles presentation.
  - `PlayerController` handles inputs and physics.

## 3. Modification Guidelines
- When adding new blocks, update `src/shared/blocks.ts` and `ItemRegistry.ts`.
- When adding 3D assets, update `ASSET_MANIFEST` in `src/assets/manifest.ts` and handle lazy-loading if the file size exceeds 10MB.
