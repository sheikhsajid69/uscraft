import { createNoise2D } from 'simplex-noise';
import { BlockType } from '../shared/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../shared/constants';

function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class WorldGenerator {
  private terrainNoise: (x: number, y: number) => number;
  private detailNoise: (x: number, y: number) => number;

  constructor(seed: number) {
    this.terrainNoise = createNoise2D(mulberry32(seed));
    this.detailNoise = createNoise2D(mulberry32(seed + 1));

  }

  generateChunk(chunkX: number, chunkZ: number): Uint8Array {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = chunkX * CHUNK_SIZE + x;
        const wz = chunkZ * CHUNK_SIZE + z;
        
        const h = this.getHeightAt(wx, wz);
        
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
          
          if (y === 0) {
            data[index] = BlockType.BEDROCK;
          } else if (y < h - 3) {
            data[index] = BlockType.STONE;
          } else if (y < h) {
            data[index] = BlockType.DIRT;
          } else if (y === h) {
            data[index] = BlockType.GRASS;
          } else {
            data[index] = BlockType.AIR;
          }
        }
        
        // Tree placement
        const hash = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453);
        const chance = hash - Math.floor(hash);
        
        if (chance < 1 / 150.0 && h < CHUNK_HEIGHT - 6 && data[h * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] === BlockType.GRASS) {
          const treeHeight = 4 + Math.floor((chance * 150 * 3) % 3);
          for (let ty = 0; ty < treeHeight; ty++) {
            const trunkY = h + 1 + ty;
            if (trunkY < CHUNK_HEIGHT) {
              data[trunkY * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = BlockType.WOOD;
            }
          }
          
          // Leaves
          for (let ly = h + 1 + treeHeight - 2; ly <= h + 1 + treeHeight + 1; ly++) {
            const radius = ly > h + 1 + treeHeight ? 1 : 2;
            for (let lx = x - radius; lx <= x + radius; lx++) {
              for (let lz = z - radius; lz <= z + radius; lz++) {
                if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ly < CHUNK_HEIGHT) {
                  const dist = Math.sqrt((lx - x) * (lx - x) + (lz - z) * (lz - z));
                  if (dist <= radius + 0.5) {
                    const lIndex = ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
                    if (data[lIndex] === BlockType.AIR) {
                      data[lIndex] = BlockType.LEAVES;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return data;
  }

  getHeightAt(wx: number, wz: number): number {
    let base = 20 + this.terrainNoise(wx * 0.01, wz * 0.01) * 15;
    let detail = this.detailNoise(wx * 0.05, wz * 0.05) * 4;
    return Math.max(1, Math.min(CHUNK_HEIGHT - 1, Math.round(base + detail)));
  }
}
