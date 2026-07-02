/** Numeric identifier for every block type in the game. */
export enum BlockId {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  WATER = 5,
  WOOD = 6,
  LEAVES = 7,
  SNOW = 8,
  BEDROCK = 9,
  COBBLESTONE = 10,
  PLANKS = 11,
  GLASS = 12,
  TORCH_BLOCK = 13,
}

/** Static metadata describing a block type's visual and physical properties. */
export interface BlockDefinition {
  /** Human-readable display name. */
  readonly name: string;
  /** Hex color used for tinting / minimap display (e.g. 0x7cba3f). */
  readonly color: number;
  /** Whether the block allows light to pass through and neighbouring faces should be rendered. */
  readonly transparent: boolean;
  /** Whether the block has a collision box that entities cannot pass through. */
  readonly solid: boolean;
  /** Whether the player can destroy this block. */
  readonly breakable: boolean;
}

/** Complete lookup table of block definitions keyed by BlockId. */
export const BLOCK_DEFS: Readonly<Record<BlockId, BlockDefinition>> = {
  [BlockId.AIR]: {
    name: "Air",
    color: 0x000000,
    transparent: true,
    solid: false,
    breakable: false,
  },
  [BlockId.GRASS]: {
    name: "Grass",
    color: 0x7cba3f,
    transparent: false,
    solid: true,
    breakable: true,
  },
  [BlockId.DIRT]: {
    name: "Dirt",
    color: 0x8b6914,
    transparent: false,
    solid: true,
    breakable: true,
  },
  [BlockId.STONE]: {
    name: "Stone",
    color: 0x808080,
    transparent: false,
    solid: true,
    breakable: true,
  },
  [BlockId.SAND]: {
    name: "Sand",
    color: 0xdbc67b,
    transparent: false,
    solid: true,
    breakable: true,
  },
  [BlockId.WATER]: {
    name: "Water",
    color: 0x3f76e4,
    transparent: true,
    solid: false,
    breakable: false,
  },
  [BlockId.WOOD]: {
    name: "Wood",
    color: 0x6b4226,
    transparent: false,
    solid: true,
    breakable: true,
  },
  [BlockId.LEAVES]: {
    name: "Leaves",
    color: 0x3a5f0b,
    transparent: true,
    solid: true,
    breakable: true,
  },
  [BlockId.SNOW]: {
    name: "Snow",
    color: 0xf0f0f0,
    transparent: false,
    solid: true,
    breakable: true,
  },
  [BlockId.BEDROCK]: {
    name: "Bedrock",
    color: 0x333333,
    transparent: false,
    solid: true,
    breakable: false,
  },
  [BlockId.COBBLESTONE]: {
    name: "Cobblestone",
    color: 0x6b6b6b,
    transparent: false,
    solid: true,
    breakable: true,
  },
  [BlockId.PLANKS]: {
    name: "Planks",
    color: 0xb8945f,
    transparent: false,
    solid: true,
    breakable: true,
  },
  [BlockId.GLASS]: {
    name: "Glass",
    color: 0xc8e6f5,
    transparent: true,
    solid: true,
    breakable: true,
  },
  [BlockId.TORCH_BLOCK]: {
    name: "Torch",
    color: 0xffaa00,
    transparent: true,
    solid: false,
    breakable: true,
  },
} as const;
