import express from "express";
import cors from "cors";
import http from "node:http";
import { Server as SocketIOServer } from "socket.io";

import type {
  ChunkRequestPacket,
  ChunkDataPacket,
  PlayerMovePacket,
  BlockEditPacket,
  WorldStatePacket,
  PlayerJoinPacket,
  PlayerLeavePacket,
} from "@voxelia/shared";
import { WorldStore } from "./world/WorldStore.js";

// ── Configuration ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";

const ALLOWED_ORIGINS: string[] = [
  "http://localhost:3000",
  CORS_ORIGIN,
];

// ── Express + HTTP ──────────────────────────────────────────────────────────

const app = express();

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

const httpServer = http.createServer(app);

// ── Socket.IO ───────────────────────────────────────────────────────────────

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ── World state & Active Players ────────────────────────────────────────────

const world = new WorldStore();

interface ConnectedPlayer {
  position: [number, number, number];
  rotation: [number, number];
}

const activePlayers = new Map<string, ConnectedPlayer>();

// ── Socket event handlers ───────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[io] client connected: ${socket.id}`);

  // Initial player position
  const initialPos: [number, number, number] = [0, 80, 0];
  const initialRot: [number, number] = [0, 0];
  activePlayers.set(socket.id, { position: initialPos, rotation: initialRot });

  // Send current world state (other connected players) to the new client
  const playerList = Array.from(activePlayers.entries())
    .filter(([id]) => id !== socket.id)
    .map(([id, p]) => ({
      playerId: id,
      position: p.position,
      rotation: p.rotation,
    }));

  const worldState: WorldStatePacket = { players: playerList };
  socket.emit("worldState", worldState);

  // Notify other clients that this player joined
  const joinPacket: PlayerJoinPacket = {
    playerId: socket.id,
    position: initialPos,
  };
  socket.broadcast.emit("playerJoin", joinPacket);

  // Chunk request handling
  socket.on("requestChunk", (packet: ChunkRequestPacket) => {
    const { cx, cz } = packet;
    const blocks = world.getChunk(cx, cz);

    const response: ChunkDataPacket = {
      cx,
      cz,
      blocks: Array.from(blocks),
    };

    socket.emit("chunkData", response);
  });

  // Player movement handling
  socket.on("playerMove", (packet: PlayerMovePacket) => {
    const player = activePlayers.get(socket.id);
    if (player) {
      player.position = packet.position;
      player.rotation = packet.rotation;
    }
    // Broadcast movement to all peers
    socket.broadcast.emit("playerMove", {
      playerId: socket.id,
      position: packet.position,
      rotation: packet.rotation,
    });
  });

  // Block editing handling
  socket.on("blockEdit", (packet: BlockEditPacket) => {
    // Update authoritative server world and persist to SQLite
    world.setBlock(packet.x, packet.y, packet.z, packet.blockId);

    // Broadcast block edit to all peers
    socket.broadcast.emit("blockEdit", {
      playerId: socket.id,
      x: packet.x,
      y: packet.y,
      z: packet.z,
      blockId: packet.blockId,
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[io] client disconnected: ${socket.id} (${reason})`);
    activePlayers.delete(socket.id);

    const leavePacket: PlayerLeavePacket = { playerId: socket.id };
    io.emit("playerLeave", leavePacket);
  });
});

// ── Start ───────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[voxelia-server] listening on port ${PORT}`);
  console.log(`[voxelia-server] CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
