import { io, Socket } from 'socket.io-client';
import { Scene, Vector3, Mesh, BoxGeometry, MeshLambertMaterial, Object3D } from 'three';
import type {
  ServerPacket,
  ClientPacket,
  BlockEditPacket,
  PlayerMovePacket,
  WorldStatePacket,
  PlayerJoinPacket,
  PlayerLeavePacket,
  BlockId,
} from '@voxelia/shared';
import type { ChunkManager } from './ChunkManager';
import type { PlayerController } from './PlayerController';

export interface PeerAvatar {
  readonly id: string;
  readonly group: Object3D;
  targetPosition: Vector3;
  targetYaw: number;
}

export class NetworkClient {
  private socket: Socket | null = null;
  private readonly peers = new Map<string, PeerAvatar>();
  private readonly scene: Scene;
  private readonly chunks: ChunkManager;
  private readonly player: PlayerController;
  private syncTimer = 0;

  constructor(scene: Scene, chunks: ChunkManager, player: PlayerController) {
    this.scene = scene;
    this.chunks = chunks;
    this.player = player;
  }

  public connect(url: string = 'http://localhost:3001'): void {
    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('[Net] Connected to server, socket id:', this.socket?.id);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Net] Multiplayer server offline or unreachable:', err.message);
    });

    this.socket.on('worldState', (packet: WorldStatePacket) => {
      // Sync players
      for (const p of packet.players) {
        if (p.playerId === this.socket?.id) continue;
        this.addOrUpdatePeer(p.playerId, p.position, p.rotation[0]);
      }
      // Sync block edits
      if (packet.blockEdits) {
        for (const edit of packet.blockEdits) {
          this.chunks.setBlock(edit.x, edit.y, edit.z, edit.blockId);
        }
      }
    });

    this.socket.on('playerJoin', (packet: PlayerJoinPacket) => {
      if (packet.playerId === this.socket?.id) return;
      this.addOrUpdatePeer(packet.playerId, packet.position, packet.rotation ? packet.rotation[0] : 0);
    });

    this.socket.on('playerLeave', (packet: PlayerLeavePacket) => {
      this.removePeer(packet.playerId);
    });

    this.socket.on('playerMove', (packet: PlayerMovePacket) => {
      if (packet.playerId === this.socket?.id) return;
      const peer = this.peers.get(packet.playerId);
      if (peer) {
        peer.targetPosition.set(packet.position[0], packet.position[1], packet.position[2]);
        peer.targetYaw = packet.rotation[0];
      } else {
        this.addOrUpdatePeer(packet.playerId, packet.position, packet.rotation[0]);
      }
    });

    this.socket.on('blockEdit', (packet: BlockEditPacket) => {
      this.chunks.setBlock(packet.x, packet.y, packet.z, packet.blockId);
    });
  }

  private addOrUpdatePeer(id: string, pos: [number, number, number], yaw: number): void {
    let peer = this.peers.get(id);
    if (!peer) {
      const group = new Object3D();
      // Generate unique color from id
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
      const colorHex = (hash & 0x00ffffff) | 0x202020;

      const mat = new MeshLambertMaterial({ color: colorHex });
      const body = new Mesh(new BoxGeometry(0.6, 1.3, 0.3), mat);
      body.position.y = -0.55;
      body.castShadow = true;
      group.add(body);

      const head = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), mat);
      head.position.y = 0.35;
      head.castShadow = true;
      group.add(head);

      group.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(group);

      peer = {
        id,
        group,
        targetPosition: new Vector3(pos[0], pos[1], pos[2]),
        targetYaw: yaw,
      };
      this.peers.set(id, peer);
    } else {
      peer.targetPosition.set(pos[0], pos[1], pos[2]);
      peer.targetYaw = yaw;
    }
  }

  private removePeer(id: string): void {
    const peer = this.peers.get(id);
    if (peer) {
      this.scene.remove(peer.group);
      peer.group.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      this.peers.delete(id);
    }
  }

  public sendBlockEdit(x: number, y: number, z: number, blockId: BlockId): void {
    if (!this.socket?.connected) return;
    const packet: BlockEditPacket = {
      playerId: this.socket.id || '',
      x,
      y,
      z,
      blockId,
    };
    this.socket.emit('blockEdit', packet);
  }

  public update(dt: number): void {
    // Interpolate peers
    for (const peer of this.peers.values()) {
      peer.group.position.lerp(peer.targetPosition, Math.min(1, dt * 12));
      // Smooth angle interpolation
      let diff = peer.targetYaw - peer.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      peer.group.rotation.y += diff * Math.min(1, dt * 12);
    }

    // Emit player move
    if (!this.socket?.connected) return;
    this.syncTimer += dt;
    if (this.syncTimer >= 0.05) {
      this.syncTimer = 0;
      const pos = this.player.getPosition();
      const [yaw, pitch] = this.player.getRotation();
      const packet: PlayerMovePacket = {
        playerId: this.socket.id || '',
        position: [pos.x, pos.y, pos.z],
        rotation: [yaw, pitch],
      };
      this.socket.emit('playerMove', packet);
    }
  }

  public disconnect(): void {
    for (const id of this.peers.keys()) {
      this.removePeer(id);
    }
    this.socket?.disconnect();
    this.socket = null;
  }
}
