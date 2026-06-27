# USCraft

USCraft is a lightweight, browser-based voxel engine inspired by Minecraft. Built with Vite, TypeScript, and Three.js, it leverages advanced rendering techniques like greedy meshing and procedural generation to deliver a smooth 3D sandbox experience directly in the browser.

## Key Features
- **Procedural Terrain**: Infinite chunk-based world generation utilizing Simplex Noise.
- **Greedy Meshing**: Highly optimized geometry construction that combines adjacent co-planar block faces to drastically reduce polygon count and draw calls.
- **Custom Physics**: Robust bounding-box (Box3) collisions and Digital Differential Analyzer (DDA) raycasting for precise block interactions.
- **Rich Assets**: Seamless asynchronous loading of `.glb` 3D models (characters, items, structures) placed dynamically into the voxel world.
- **Interactive UI**: A lightweight, framework-free HTML/CSS overlay system managing the HUD, hotbar, and drag-and-drop inventory interfaces.

## Quick Start
Ensure you have [Node.js](https://nodejs.org/) installed, then run:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```
Navigate to `http://localhost:3000` (or the port specified in your console) to play.

## Controls
- **W, A, S, D** — Movement
- **Space** — Jump
- **Shift** — Sprint
- **Left Click** — Break Block
- **Right Click** — Place Block / Interact (e.g., Open Chests)
- **E** — Toggle Inventory Screen
- **Scroll Wheel** — Cycle Hotbar Selection