import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
  Color,
  DoubleSide,
} from 'three';
import {
  BlockId,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Z,
  CHUNK_HEIGHT,
  BLOCK_DEFS,
} from '@voxelia/shared';

const WATER_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Subtle wave animation on vertices
    float wave = sin(pos.x * 0.8 + uTime * 2.0) * cos(pos.z * 0.8 + uTime * 1.8) * 0.08;
    pos.y += wave;
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const WATER_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform vec3 uColor;
  uniform float uTime;

  void main() {
    // Normal-map ripple simulation
    float ripple1 = sin(vWorldPos.x * 2.0 + uTime * 3.0 + sin(vWorldPos.z * 2.0));
    float ripple2 = cos(vWorldPos.z * 2.0 - uTime * 2.5 + cos(vWorldPos.x * 2.0));
    float combined = (ripple1 + ripple2) * 0.05;

    vec3 color = uColor + vec3(combined);
    // Subtle specular highlight on crests
    if (combined > 0.06) {
      color += vec3(0.15, 0.2, 0.25);
    }

    gl_FragColor = vec4(color, 0.65);
  }
`;

export class WaterMesher {
  private readonly material: ShaderMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(0x3f76e4) },
      },
      transparent: true,
      side: DoubleSide,
      depthWrite: false, // Prevents z-fighting between transparent water faces
    });
  }

  /** Update elapsed time uniform for animation. */
  public update(dt: number): void {
    this.material.uniforms['uTime']!.value += dt;
  }

  /**
   * Generates a separate mesh for WATER blocks in a chunk column.
   */
  public buildWaterMesh(blocks: Uint8Array): Mesh | null {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vertexCount = 0;

    const getBlock = (lx: number, ly: number, lz: number): BlockId => {
      if (lx < 0 || lx >= CHUNK_SIZE_X || lz < 0 || lz >= CHUNK_SIZE_Z || ly < 0 || ly >= CHUNK_HEIGHT) {
        return BlockId.AIR;
      }
      return blocks[lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z] as BlockId;
    };

    for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
        for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
          if (getBlock(lx, ly, lz) !== BlockId.WATER) continue;

          // Only emit top face if above is not water
          const above = getBlock(lx, ly + 1, lz);
          if (above === BlockId.WATER) continue;

          // Top face quad
          const y = ly + 0.88; // slightly lowered water level
          positions.push(
            lx, y, lz,
            lx, y, lz + 1,
            lx + 1, y, lz + 1,
            lx + 1, y, lz
          );
          uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }
      }
    }

    if (positions.length === 0) return null;

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new Mesh(geometry, this.material);
    mesh.name = 'water_mesh';
    mesh.renderOrder = 1; // Render after solid terrain
    return mesh;
  }
}
