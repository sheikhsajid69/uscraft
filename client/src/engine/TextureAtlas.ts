/**
 * TextureAtlas.ts – Runtime procedural texture atlas for a Minecraft-style
 * voxel game.  Generates a 256×256 canvas containing 16×16 pixel-art tiles
 * for every block face and exposes UV helpers consumed by the chunk mesher.
 *
 * Atlas layout (row-major, 0-indexed):
 *   0  grass_top      1  grass_side     2  dirt          3  stone
 *   4  sand           5  water          6  wood_side     7  wood_top
 *   8  leaves         9  snow          10  bedrock      11  cobblestone
 *  12  planks        13  glass         14  torch
 */

import { CanvasTexture, NearestFilter } from 'three';
import { BlockId } from '@voxelia/shared';

// ── Constants ────────────────────────────────────────────────────────────────

const ATLAS_SIZE = 256;
const TILE_SIZE  = 16;
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE; // 16

// ── Tile index constants ─────────────────────────────────────────────────────

const TILE_GRASS_TOP    = 0;
const TILE_GRASS_SIDE   = 1;
const TILE_DIRT         = 2;
const TILE_STONE        = 3;
const TILE_SAND         = 4;
const TILE_WATER        = 5;
const TILE_WOOD_SIDE    = 6;
const TILE_WOOD_TOP     = 7;
const TILE_LEAVES       = 8;
const TILE_SNOW         = 9;
const TILE_BEDROCK      = 10;
const TILE_COBBLESTONE  = 11;
const TILE_PLANKS       = 12;
const TILE_GLASS        = 13;
const TILE_TORCH        = 14;

// ── Face-index convention ────────────────────────────────────────────────────
// 0 = top (+Y)   1 = bottom (-Y)   2 = north (+Z)
// 3 = south (-Z) 4 = east (+X)     5 = west (-X)

/** Per-block mapping: faceIndex → tile index. */
const BLOCK_FACE_TILES: Record<number, readonly [number, number, number, number, number, number]> = {
  //                              top             bottom          north           south           east            west
  [BlockId.GRASS]:       [TILE_GRASS_TOP,  TILE_DIRT,       TILE_GRASS_SIDE, TILE_GRASS_SIDE, TILE_GRASS_SIDE, TILE_GRASS_SIDE],
  [BlockId.DIRT]:        [TILE_DIRT,       TILE_DIRT,       TILE_DIRT,       TILE_DIRT,       TILE_DIRT,       TILE_DIRT],
  [BlockId.STONE]:       [TILE_STONE,     TILE_STONE,      TILE_STONE,      TILE_STONE,      TILE_STONE,      TILE_STONE],
  [BlockId.SAND]:        [TILE_SAND,      TILE_SAND,       TILE_SAND,       TILE_SAND,       TILE_SAND,       TILE_SAND],
  [BlockId.WATER]:       [TILE_WATER,     TILE_WATER,      TILE_WATER,      TILE_WATER,      TILE_WATER,      TILE_WATER],
  [BlockId.WOOD]:        [TILE_WOOD_TOP,  TILE_WOOD_TOP,   TILE_WOOD_SIDE,  TILE_WOOD_SIDE,  TILE_WOOD_SIDE,  TILE_WOOD_SIDE],
  [BlockId.LEAVES]:      [TILE_LEAVES,    TILE_LEAVES,     TILE_LEAVES,     TILE_LEAVES,     TILE_LEAVES,     TILE_LEAVES],
  [BlockId.SNOW]:        [TILE_SNOW,      TILE_SNOW,       TILE_SNOW,       TILE_SNOW,       TILE_SNOW,       TILE_SNOW],
  [BlockId.BEDROCK]:     [TILE_BEDROCK,   TILE_BEDROCK,    TILE_BEDROCK,    TILE_BEDROCK,    TILE_BEDROCK,    TILE_BEDROCK],
  [BlockId.COBBLESTONE]: [TILE_COBBLESTONE, TILE_COBBLESTONE, TILE_COBBLESTONE, TILE_COBBLESTONE, TILE_COBBLESTONE, TILE_COBBLESTONE],
  [BlockId.PLANKS]:      [TILE_PLANKS,    TILE_PLANKS,     TILE_PLANKS,     TILE_PLANKS,     TILE_PLANKS,     TILE_PLANKS],
  [BlockId.GLASS]:       [TILE_GLASS,     TILE_GLASS,      TILE_GLASS,      TILE_GLASS,      TILE_GLASS,      TILE_GLASS],
  [BlockId.TORCH_BLOCK]: [TILE_TORCH,     TILE_TORCH,      TILE_TORCH,      TILE_TORCH,      TILE_TORCH,      TILE_TORCH],
};

// ── Public types ─────────────────────────────────────────────────────────────

export interface TileUV {
  /** Top-left U coordinate (0-1 normalised). */
  u0: number;
  /** Top-left V coordinate (0-1 normalised). */
  v0: number;
  /** Bottom-right U coordinate (0-1 normalised). */
  u1: number;
  /** Bottom-right V coordinate (0-1 normalised). */
  v1: number;
}

// ── UV helpers ───────────────────────────────────────────────────────────────

/** Convert a linear tile index to normalised atlas UV coordinates. */
function tileIndexToUV(tileIndex: number): TileUV {
  const col = tileIndex % TILES_PER_ROW;
  const row = Math.floor(tileIndex / TILES_PER_ROW);
  const tileNorm = TILE_SIZE / ATLAS_SIZE; // 1/16 = 0.0625
  return {
    u0: col * tileNorm,
    v0: row * tileNorm,
    u1: (col + 1) * tileNorm,
    v1: (row + 1) * tileNorm,
  };
}

/**
 * Look up the atlas UV rectangle for a given block type and face.
 *
 * @param blockId  - The `BlockId` enum value.
 * @param faceIndex - Face index: 0=top, 1=bottom, 2=north, 3=south, 4=east, 5=west.
 * @returns Normalised UV rectangle within the 256×256 atlas.
 */
export function getBlockFaceUV(blockId: BlockId, faceIndex: number): TileUV {
  const mapping = BLOCK_FACE_TILES[blockId as number];
  if (!mapping) {
    // Fallback for unknown blocks – use tile 0 (grass_top)
    return tileIndexToUV(0);
  }
  const tileIdx = mapping[Math.min(Math.max(faceIndex, 0), 5)];
  return tileIndexToUV(tileIdx);
}

// ── Seeded-random helper ─────────────────────────────────────────────────────

/** Deterministic per-pixel noise in [0, 1). */
function noise(x: number, y: number, seed: number): number {
  // Use a large prime-based hash to avoid obvious periodicity
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h >>> 0) % 256) / 255;
}

// ── Colour utilities ─────────────────────────────────────────────────────────

/** Extract [r, g, b] from a 24-bit hex integer. */
function hexRGB(hex: number): [number, number, number] {
  return [(hex >>> 16) & 0xff, (hex >>> 8) & 0xff, hex & 0xff];
}

/** Clamp an integer to 0-255. */
function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/** Return an RGBA CSS string. */
function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${clamp255(r)},${clamp255(g)},${clamp255(b)},${a})`;
}

/** Vary a base colour's RGB channels by ±`range` using deterministic noise. */
function varyColor(
  base: [number, number, number],
  x: number,
  y: number,
  seed: number,
  range: number,
  alpha = 1,
): string {
  const n = noise(x, y, seed);
  const offset = (n - 0.5) * 2 * range; // in [-range, +range]
  return rgba(base[0] + offset, base[1] + offset, base[2] + offset, alpha);
}

// ── Individual tile painters ─────────────────────────────────────────────────
// Every function draws into a 16×16 region starting at (ox, oy) in the atlas.

type TilePainter = (ctx: CanvasRenderingContext2D, ox: number, oy: number) => void;

/** Set a single pixel via fillRect. */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// ── GRASS_TOP ────────────────────────────────────────────────────────────────

const paintGrassTop: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0x7cba3f);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = noise(x, y, 1);
      if (n < 0.15) {
        // darker green spots
        px(ctx, ox + x, oy + y, rgba(base[0] - 30, base[1] - 25, base[2] - 15, 1));
      } else if (n < 0.25) {
        // slightly lighter
        px(ctx, ox + x, oy + y, rgba(base[0] + 15, base[1] + 10, base[2] + 8, 1));
      } else {
        px(ctx, ox + x, oy + y, varyColor(base, x, y, 2, 10));
      }
    }
  }
};

// ── GRASS_SIDE ───────────────────────────────────────────────────────────────

const paintGrassSide: TilePainter = (ctx, ox, oy) => {
  const dirt: [number, number, number] = hexRGB(0x8b6914);
  const green: [number, number, number] = hexRGB(0x7cba3f);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (y < 3) {
        // Green grass strip on top, graduated darker toward row 2
        const darken = y * 8;
        const n = noise(x, y, 3);
        const vary = (n - 0.5) * 16;
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(
            green[0] - darken + vary,
            green[1] - darken + vary,
            green[2] - darken / 2 + vary,
            1,
          ),
        );
      } else {
        // Dirt below
        px(ctx, ox + x, oy + y, varyColor(dirt, x, y, 4, 12));
      }
    }
  }
};

// ── DIRT ─────────────────────────────────────────────────────────────────────

const paintDirt: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0x8b6914);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = noise(x, y, 5);
      if (n < 0.1) {
        px(ctx, ox + x, oy + y, rgba(base[0] + 20, base[1] + 15, base[2] + 10, 1));
      } else if (n > 0.85) {
        px(ctx, ox + x, oy + y, rgba(base[0] - 18, base[1] - 12, base[2] - 8, 1));
      } else {
        px(ctx, ox + x, oy + y, varyColor(base, x, y, 6, 10));
      }
    }
  }
};

// ── STONE ────────────────────────────────────────────────────────────────────

const paintStone: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0x808080);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      px(ctx, ox + x, oy + y, varyColor(base, x, y, 7, 8));
    }
  }

  // Horizontal crack-like darker lines
  const crackSeeds = [3, 7, 12];
  for (const cs of crackSeeds) {
    const cy = cs % TILE_SIZE;
    const startX = (cs * 3) % 6;
    const length = 5 + (cs * 7) % 8;
    for (let i = 0; i < length && startX + i < TILE_SIZE; i++) {
      const cx = startX + i;
      px(ctx, ox + cx, oy + cy, rgba(base[0] - 35, base[1] - 35, base[2] - 35, 1));
      // Occasional 2px height crack
      if (i % 3 === 0 && cy + 1 < TILE_SIZE) {
        px(ctx, ox + cx, oy + cy + 1, rgba(base[0] - 28, base[1] - 28, base[2] - 28, 1));
      }
    }
  }

  // Lighter mineral flecks
  for (let i = 0; i < 8; i++) {
    const fx = ((i * 37 + 5) % TILE_SIZE) | 0;
    const fy = ((i * 23 + 11) % TILE_SIZE) | 0;
    px(ctx, ox + fx, oy + fy, rgba(base[0] + 30, base[1] + 30, base[2] + 35, 1));
  }
};

// ── SAND ─────────────────────────────────────────────────────────────────────

const paintSand: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0xdbc67b);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = noise(x, y, 9);
      if (n < 0.12) {
        // Darker grain speck
        px(ctx, ox + x, oy + y, rgba(base[0] - 20, base[1] - 18, base[2] - 12, 1));
      } else if (n > 0.9) {
        // Lighter grain speck
        px(ctx, ox + x, oy + y, rgba(base[0] + 15, base[1] + 12, base[2] + 8, 1));
      } else {
        px(ctx, ox + x, oy + y, varyColor(base, x, y, 10, 6));
      }
    }
  }
};

// ── WATER ────────────────────────────────────────────────────────────────────

const paintWater: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0x3f76e4);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const wave = Math.sin((x + y * 0.5) * 0.8) * 12;
      const n = noise(x, y, 11);
      const vary = (n - 0.5) * 14;
      px(
        ctx,
        ox + x,
        oy + y,
        rgba(
          base[0] + wave + vary,
          base[1] + wave * 0.5 + vary,
          base[2] + vary * 0.5,
          0.7, // semi-transparent
        ),
      );
    }
  }
};

// ── WOOD_SIDE ────────────────────────────────────────────────────────────────

const paintWoodSide: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0x6b4226);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      // Vertical grain lines every 3-4 pixels
      const isGrain = x % 4 === 0 || x % 4 === 1;
      if (isGrain) {
        const n = noise(x, y, 13);
        const vary = (n - 0.5) * 8;
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(base[0] - 20 + vary, base[1] - 14 + vary, base[2] - 10 + vary, 1),
        );
      } else {
        px(ctx, ox + x, oy + y, varyColor(base, x, y, 14, 8));
      }
    }
  }
};

// ── WOOD_TOP ─────────────────────────────────────────────────────────────────

const paintWoodTop: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0x8b6914);
  const ring: [number, number, number] = hexRGB(0x6b4226);
  const cx = 7.5;
  const cy = 7.5;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Concentric rings every ~3 pixels
      const ringPhase = dist % 3;
      if (ringPhase < 0.8) {
        // Ring line
        const n = noise(x, y, 15);
        const vary = (n - 0.5) * 10;
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(ring[0] + vary, ring[1] + vary, ring[2] + vary, 1),
        );
      } else {
        px(ctx, ox + x, oy + y, varyColor(base, x, y, 16, 8));
      }
    }
  }
};

// ── LEAVES ───────────────────────────────────────────────────────────────────

const paintLeaves: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0x3a5f0b);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = noise(x, y, 17);
      if (n < 0.08) {
        // Transparency holes
        px(ctx, ox + x, oy + y, rgba(0, 0, 0, 0));
      } else if (n < 0.3) {
        // Lighter patches for depth
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(base[0] + 30, base[1] + 35, base[2] + 15, 0.9),
        );
      } else if (n > 0.8) {
        // Darker patches
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(base[0] - 15, base[1] - 20, base[2] - 5, 0.92),
        );
      } else {
        px(ctx, ox + x, oy + y, varyColor(base, x, y, 18, 10));
      }
    }
  }
};

// ── SNOW ─────────────────────────────────────────────────────────────────────

const paintSnow: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0xf0f0f0);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = noise(x, y, 19);
      if (n < 0.08) {
        // Subtle blue-gray specks
        px(ctx, ox + x, oy + y, rgba(210, 215, 225, 1));
      } else {
        px(ctx, ox + x, oy + y, varyColor(base, x, y, 20, 4));
      }
    }
  }
};

// ── BEDROCK ──────────────────────────────────────────────────────────────────

const paintBedrock: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0x333333);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = noise(x, y, 21);
      if (n < 0.15) {
        // Irregular lighter patches
        px(ctx, ox + x, oy + y, rgba(base[0] + 40, base[1] + 38, base[2] + 35, 1));
      } else if (n > 0.85) {
        // Even lighter patch
        px(ctx, ox + x, oy + y, rgba(base[0] + 55, base[1] + 50, base[2] + 48, 1));
      } else {
        px(ctx, ox + x, oy + y, varyColor(base, x, y, 22, 10));
      }
    }
  }
};

// ── COBBLESTONE ──────────────────────────────────────────────────────────────

const paintCobblestone: TilePainter = (ctx, ox, oy) => {
  const lightGray: [number, number, number] = [140, 140, 140];
  const darkGray:  [number, number, number] = [90, 90, 90];
  const mortar:    [number, number, number] = [160, 155, 145];

  // Define cobble stone regions (approximate irregular grid)
  // Each region is [x0, y0, w, h]
  const stones: [number, number, number, number][] = [
    [0, 0, 5, 4],   [6, 0, 4, 5],   [11, 0, 5, 4],
    [0, 5, 4, 5],   [5, 5, 5, 4],   [11, 5, 5, 5],
    [0, 11, 5, 5],  [6, 10, 5, 6],  [12, 11, 4, 5],
  ];

  // Fill with mortar first
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      px(ctx, ox + x, oy + y, varyColor(mortar, x, y, 23, 6));
    }
  }

  // Paint each stone
  for (const [sx, sy, sw, sh] of stones) {
    const n0 = noise(sx, sy, 24);
    const isLight = n0 > 0.4;
    const stoneBase = isLight ? lightGray : darkGray;

    for (let dy = 0; dy < sh && sy + dy < TILE_SIZE; dy++) {
      for (let dx = 0; dx < sw && sx + dx < TILE_SIZE; dx++) {
        const px2 = sx + dx;
        const py2 = sy + dy;
        px(ctx, ox + px2, oy + py2, varyColor(stoneBase, px2, py2, 25, 12));
      }
    }
  }
};

// ── PLANKS ───────────────────────────────────────────────────────────────────

const paintPlanks: TilePainter = (ctx, ox, oy) => {
  const base: [number, number, number] = hexRGB(0xb8945f);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      // Horizontal plank division lines at y=3, y=7, y=11, y=15
      const isPlankLine = y % 4 === 3;
      if (isPlankLine) {
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(base[0] - 35, base[1] - 30, base[2] - 20, 1),
        );
      } else {
        // Subtle horizontal grain: slightly vary per-row
        const rowShift = ((y * 13) % 7) - 3;
        const n = noise(x, y, 27);
        const vary = (n - 0.5) * 12;
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(
            base[0] + rowShift + vary,
            base[1] + rowShift * 0.7 + vary,
            base[2] + rowShift * 0.4 + vary,
            1,
          ),
        );
      }
    }
  }
};

// ── GLASS ────────────────────────────────────────────────────────────────────

const paintGlass: TilePainter = (ctx, ox, oy) => {
  const border: [number, number, number] = hexRGB(0x9bbdd4);
  const fill:   [number, number, number] = hexRGB(0xc8e6f5);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const isBorder = x === 0 || x === TILE_SIZE - 1 || y === 0 || y === TILE_SIZE - 1;
      if (isBorder) {
        px(ctx, ox + x, oy + y, rgba(border[0], border[1], border[2], 0.85));
      } else {
        // Mostly transparent with very faint tint
        const n = noise(x, y, 29);
        const highlight = n > 0.92 ? 20 : 0;
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(fill[0] + highlight, fill[1] + highlight, fill[2] + highlight, 0.15),
        );
      }
    }
  }
};

// ── TORCH ────────────────────────────────────────────────────────────────────

const paintTorch: TilePainter = (ctx, ox, oy) => {
  const center: [number, number, number] = hexRGB(0xffaa00);
  const glow:   [number, number, number] = hexRGB(0xff6600);
  const cx = 7.5;
  const cy = 7.5;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 3) {
        // Bright core
        const n = noise(x, y, 31);
        const flicker = (n - 0.5) * 20;
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(
            center[0] + flicker,
            center[1] + flicker * 0.6,
            center[2] + flicker * 0.3,
            1,
          ),
        );
      } else if (dist < 6) {
        // Warm glow ring
        const falloff = 1 - (dist - 3) / 3;
        const n = noise(x, y, 32);
        const vary = (n - 0.5) * 15;
        px(
          ctx,
          ox + x,
          oy + y,
          rgba(
            glow[0] * falloff + center[0] * (1 - falloff) + vary,
            glow[1] * falloff + center[1] * (1 - falloff) + vary * 0.5,
            glow[2] * falloff + vary * 0.3,
            0.8 * falloff + 0.2,
          ),
        );
      } else {
        // Outer dark, mostly transparent
        px(ctx, ox + x, oy + y, rgba(40, 20, 0, 0.15));
      }
    }
  }
};

// ── Tile painter registry ────────────────────────────────────────────────────

const TILE_PAINTERS: readonly TilePainter[] = [
  paintGrassTop,     // 0
  paintGrassSide,    // 1
  paintDirt,         // 2
  paintStone,        // 3
  paintSand,         // 4
  paintWater,        // 5
  paintWoodSide,     // 6
  paintWoodTop,      // 7
  paintLeaves,       // 8
  paintSnow,         // 9
  paintBedrock,      // 10
  paintCobblestone,  // 11
  paintPlanks,       // 12
  paintGlass,        // 13
  paintTorch,        // 14
];

// ── Atlas builder ────────────────────────────────────────────────────────────

/**
 * Create a 256×256 `CanvasTexture` containing all procedurally-drawn block
 * tiles. The texture is configured with `NearestFilter` for the pixelated
 * Minecraft aesthetic.
 */
export function createAtlasTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;

  const ctx = canvas.getContext('2d')!;

  // Clear to fully transparent black
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  // Draw every tile
  for (let i = 0; i < TILE_PAINTERS.length; i++) {
    const col = i % TILES_PER_ROW;
    const row = Math.floor(i / TILES_PER_ROW);
    const ox = col * TILE_SIZE;
    const oy = row * TILE_SIZE;
    TILE_PAINTERS[i](ctx, ox, oy);
  }

  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  // Flip Y is true by default for CanvasTexture – this matches our UV layout
  // where v0 < v1 maps to top-to-bottom in canvas pixel space.
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
}
