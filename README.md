# Voxelia

A browser-based voxel sandbox inspired by Minecraft. Procedurally generated terrain anchored around hand-modeled GLB set pieces, with real mob AI, crafting, building, and multiplayer.

## Quick Start

```bash
# Install all workspace dependencies
npm install

# Start the server (terminal 1)
npm run dev:server

# Start the client (terminal 2)
npm run dev:client
```

Open `http://localhost:3000` in your browser.

## Controls

- **WASD** — Move
- **Mouse** — Look around
- **Space** — Fly up
- **Shift** — Fly down
- **Click canvas** — Lock pointer

## Project Structure

```
voxelia/
├── client/    # Vite + Three.js + Vue 3 frontend
├── server/    # Node.js authoritative game server
├── shared/    # Types, constants, utils shared by both
└── assets/    # Source GLB models and textures
```

## Development Phases

See [MINECRAFT_BROWSER_REPLICA_BLUEPRINT.md](./MINECRAFT_BROWSER_REPLICA_BLUEPRINT.md) for the full 10-phase plan.
