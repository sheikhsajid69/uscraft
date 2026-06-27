import * as THREE from 'three';
import { BlockType } from '../shared/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../shared/constants';
import { getBlockDef, isBlockSolid, isBlockTransparent } from './BlockRegistry';

export class ChunkMesher {
  meshChunk(data: Uint8Array, chunkX: number, chunkZ: number, getNeighborBlock: (wx: number, wy: number, wz: number) => BlockType): THREE.Mesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let indexCount = 0;

    const getBlock = (x: number, y: number, z: number): BlockType => {
      if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
        return getNeighborBlock(chunkX * CHUNK_SIZE + x, y, chunkZ * CHUNK_SIZE + z);
      }
      return data[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x];
    };

    // Greedy meshing over 3 axes
    for (let d = 0; d < 3; d++) {
      let u = (d + 1) % 3;
      let v = (d + 2) % 3;
      
      const dims = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE];
      const x = [0, 0, 0];
      const q = [0, 0, 0];
      q[d] = 1;
      
      const mask = new Int32Array(dims[u] * dims[v]);
      const maskColors = new Float32Array(dims[u] * dims[v] * 3);
      const maskAo = new Float32Array(dims[u] * dims[v]);

      for (x[d] = -1; x[d] < dims[d];) {
        let n = 0;
        // Compute mask for this slice
        for (x[v] = 0; x[v] < dims[v]; ++x[v]) {
          for (x[u] = 0; x[u] < dims[u]; ++x[u]) {
            const b1 = x[d] >= 0 ? getBlock(x[0], x[1], x[2]) : 0;
            const b2 = x[d] < dims[d] - 1 ? getBlock(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : getBlock(x[0] + q[0], x[1] + q[1], x[2] + q[2]);
            
            const solid1 = isBlockSolid(b1);
            const solid2 = isBlockSolid(b2);
            const trans1 = isBlockTransparent(b1);
            const trans2 = isBlockTransparent(b2);

            let faceType = 0;
            let block = 0;
            
            if (solid1 && (!solid2 || trans2) && !(solid1 && trans1 && solid2 && trans2 && b1 === b2)) {
              faceType = 1;
              block = b1;
            } else if (solid2 && (!solid1 || trans1) && !(solid1 && trans1 && solid2 && trans2 && b1 === b2)) {
              faceType = -1;
              block = b2;
            }

            if (faceType !== 0) {
              mask[n] = faceType * block;
              const def = getBlockDef(block);
              let r, g, b, ao = 1.0;
              if (d === 1) { // Y axis
                if (faceType > 0) {
                  [r, g, b] = def.color;
                  ao = 1.0;
                } else {
                  [r, g, b] = def.bottomColor || def.color;
                  ao = 0.7;
                }
              } else { // X or Z axis
                [r, g, b] = def.sideColor || def.color;
                ao = 0.85;
              }
              maskColors[n * 3] = r;
              maskColors[n * 3 + 1] = g;
              maskColors[n * 3 + 2] = b;
              maskAo[n] = ao;
            } else {
              mask[n] = 0;
            }
            n++;
          }
        }
        
        ++x[d];
        
        // Generate geometry from mask
        n = 0;
        for (let j = 0; j < dims[v]; ++j) {
          for (let i = 0; i < dims[u];) {
            const maskVal = mask[n];
            if (maskVal !== 0) {
              const r = maskColors[n * 3];
              const g = maskColors[n * 3 + 1];
              const b = maskColors[n * 3 + 2];
              const ao = maskAo[n];
              
              let w = 1;
              while (i + w < dims[u] && mask[n + w] === maskVal && 
                     maskColors[(n + w) * 3] === r && maskColors[(n + w) * 3 + 1] === g && maskColors[(n + w) * 3 + 2] === b) {
                w++;
              }
              
              let h = 1;
              let done = false;
              for (let k = 1; j + k < dims[v]; ++k) {
                for (let l = 0; l < w; ++l) {
                  const idx = n + k * dims[u] + l;
                  if (mask[idx] !== maskVal || 
                      maskColors[idx * 3] !== r || maskColors[idx * 3 + 1] !== g || maskColors[idx * 3 + 2] !== b) {
                    done = true;
                    break;
                  }
                }
                if (done) break;
                h++;
              }
              
              x[u] = i;
              x[v] = j;
              
              const du = [0, 0, 0];
              du[u] = w;
              const dv = [0, 0, 0];
              dv[v] = h;
              
              const faceDir = maskVal > 0 ? 1 : -1;
              const nx = d === 0 ? faceDir : 0;
              const ny = d === 1 ? faceDir : 0;
              const nz = d === 2 ? faceDir : 0;
              
              const p1 = [x[0], x[1], x[2]];
              const p2 = [x[0] + du[0], x[1] + du[1], x[2] + du[2]];
              const p3 = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]];
              const p4 = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]];
              
              if (faceDir > 0) {
                positions.push(...p1, ...p2, ...p3, ...p4);
              } else {
                positions.push(...p1, ...p4, ...p3, ...p2);
              }
              
              normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
              
              const fr = r * ao, fg = g * ao, fb = b * ao;
              colors.push(fr, fg, fb, fr, fg, fb, fr, fg, fb, fr, fg, fb);
              
              let flip = false;
              if (d === 0) flip = faceDir < 0;
              if (d === 1) flip = faceDir > 0;
              if (d === 2) flip = faceDir < 0;
              
              if (flip) {
                indices.push(indexCount, indexCount + 2, indexCount + 1, indexCount, indexCount + 3, indexCount + 2);
              } else {
                indices.push(indexCount, indexCount + 1, indexCount + 2, indexCount, indexCount + 2, indexCount + 3);
              }
              indexCount += 4;
              
              for (let l = 0; l < h; ++l) {
                for (let k = 0; k < w; ++k) {
                  mask[n + k + l * dims[u]] = 0;
                }
              }
              i += w;
              n += w;
            } else {
              i++;
              n++;
            }
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
}
