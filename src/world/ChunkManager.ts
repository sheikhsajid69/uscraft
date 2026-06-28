import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE } from '../shared/constants';
import { BlockType } from '../shared/blocks';
import { WorldGenerator } from './WorldGenerator';
import { ChunkMesher } from './ChunkMesher';

export class ChunkManager {
  chunks: Map<string, { data: Uint8Array, mesh: THREE.Mesh | null }>;
  worldGenerator: WorldGenerator;
  chunkMesher: ChunkMesher;
  scene: THREE.Scene;
  chunksToLoad: Array<{cx: number, cz: number}>;
  loadedPerFrame: number = 1;

  constructor(scene: THREE.Scene, seed: number) {
    this.scene = scene;
    this.worldGenerator = new WorldGenerator(seed);
    this.chunkMesher = new ChunkMesher();
    this.chunks = new Map();
    this.chunksToLoad = [];
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  update(playerX: number, playerZ: number): void {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    const neededChunks = new Set<string>();

    for (let cx = pcx - RENDER_DISTANCE; cx <= pcx + RENDER_DISTANCE; cx++) {
      for (let cz = pcz - RENDER_DISTANCE; cz <= pcz + RENDER_DISTANCE; cz++) {
        neededChunks.add(this.chunkKey(cx, cz));
        
        if (!this.chunks.has(this.chunkKey(cx, cz))) {
          const alreadyInQueue = this.chunksToLoad.find(c => c.cx === cx && c.cz === cz);
          if (!alreadyInQueue) {
            this.chunksToLoad.push({cx, cz});
          }
        }
      }
    }

    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededChunks.has(key)) {
        if (chunk.mesh) {
          this.scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
          (chunk.mesh.material as THREE.Material).dispose();
        }
        this.chunks.delete(key);
      }
    }

    this.chunksToLoad = this.chunksToLoad.filter(c => neededChunks.has(this.chunkKey(c.cx, c.cz)));
    
    this.chunksToLoad.sort((a, b) => {
      const distA = Math.max(Math.abs(a.cx - pcx), Math.abs(a.cz - pcz));
      const distB = Math.max(Math.abs(b.cx - pcx), Math.abs(b.cz - pcz));
      return distA - distB;
    });

    let processed = 0;
    while (this.chunksToLoad.length > 0 && processed < this.loadedPerFrame) {
      const c = this.chunksToLoad.shift()!;
      
      const data = this.worldGenerator.generateChunk(c.cx, c.cz);
      this.chunks.set(this.chunkKey(c.cx, c.cz), { data, mesh: null });
      
      this.meshChunk(c.cx, c.cz);
      
      if (this.chunks.has(this.chunkKey(c.cx - 1, c.cz))) this.meshChunk(c.cx - 1, c.cz);
      if (this.chunks.has(this.chunkKey(c.cx + 1, c.cz))) this.meshChunk(c.cx + 1, c.cz);
      if (this.chunks.has(this.chunkKey(c.cx, c.cz - 1))) this.meshChunk(c.cx, c.cz - 1);
      if (this.chunks.has(this.chunkKey(c.cx, c.cz + 1))) this.meshChunk(c.cx, c.cz + 1);

      processed++;
    }
  }

  private meshChunk(cx: number, cz: number): void {
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return;
    
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      (chunk.mesh.material as THREE.Material).dispose();
      chunk.mesh = null;
    }
    
    const mesh = this.chunkMesher.meshChunk(chunk.data, cx, cz, (wx, wy, wz) => this.getBlock(wx, wy, wz));
    chunk.mesh = mesh;
    this.scene.add(mesh);
  }

  getBlock(wx: number, wy: number, wz: number): BlockType {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return BlockType.AIR;
    
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const index = wy * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
    return chunk.data[index];
  }

  setBlock(wx: number, wy: number, wz: number, type: BlockType): void {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return;
    
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const index = wy * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
    chunk.data[index] = type;
    
    this.meshChunk(cx, cz);
    
    if (lx === 0) this.meshChunk(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.meshChunk(cx + 1, cz);
    if (lz === 0) this.meshChunk(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.meshChunk(cx, cz + 1);
  }
}
