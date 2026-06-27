export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  SAND = 6,
  WATER = 7,
  BEDROCK = 8,
  PLANKS = 9,
  COBBLESTONE = 10,
  GLASS = 11,
  SNOW = 12,
}

export interface BlockDefinition {
  id: BlockType;
  name: string;
  solid: boolean;
  transparent: boolean;
  color: [number, number, number];
  sideColor?: [number, number, number];
  bottomColor?: [number, number, number];
  breakTime: number;
  dropsItem: boolean;
}

export const BLOCK_DEFS: Record<number, BlockDefinition> = {
  [BlockType.AIR]: {
    id: BlockType.AIR,
    name: 'Air',
    solid: false,
    transparent: true,
    color: [0, 0, 0],
    breakTime: 0,
    dropsItem: false,
  },
  [BlockType.GRASS]: {
    id: BlockType.GRASS,
    name: 'Grass',
    solid: true,
    transparent: false,
    color: [0.36, 0.7, 0.2],
    sideColor: [0.55, 0.4, 0.26],
    bottomColor: [0.55, 0.4, 0.26],
    breakTime: 0.5,
    dropsItem: true,
  },
  [BlockType.DIRT]: {
    id: BlockType.DIRT,
    name: 'Dirt',
    solid: true,
    transparent: false,
    color: [0.55, 0.4, 0.26],
    breakTime: 0.5,
    dropsItem: true,
  },
  [BlockType.STONE]: {
    id: BlockType.STONE,
    name: 'Stone',
    solid: true,
    transparent: false,
    color: [0.5, 0.5, 0.5],
    breakTime: 1.5,
    dropsItem: true,
  },
  [BlockType.WOOD]: {
    id: BlockType.WOOD,
    name: 'Wood',
    solid: true,
    transparent: false,
    color: [0.6, 0.45, 0.25],
    sideColor: [0.45, 0.3, 0.15],
    breakTime: 1.0,
    dropsItem: true,
  },
  [BlockType.LEAVES]: {
    id: BlockType.LEAVES,
    name: 'Leaves',
    solid: true,
    transparent: false,
    color: [0.2, 0.55, 0.1],
    breakTime: 0.3,
    dropsItem: false,
  },
  [BlockType.SAND]: {
    id: BlockType.SAND,
    name: 'Sand',
    solid: true,
    transparent: false,
    color: [0.86, 0.82, 0.6],
    breakTime: 0.5,
    dropsItem: true,
  },
  [BlockType.WATER]: {
    id: BlockType.WATER,
    name: 'Water',
    solid: false,
    transparent: true,
    color: [0.2, 0.4, 0.8],
    breakTime: 0,
    dropsItem: false,
  },
  [BlockType.BEDROCK]: {
    id: BlockType.BEDROCK,
    name: 'Bedrock',
    solid: true,
    transparent: false,
    color: [0.2, 0.2, 0.2],
    breakTime: Infinity,
    dropsItem: false,
  },
  [BlockType.PLANKS]: {
    id: BlockType.PLANKS,
    name: 'Planks',
    solid: true,
    transparent: false,
    color: [0.7, 0.55, 0.3],
    breakTime: 1.0,
    dropsItem: true,
  },
  [BlockType.COBBLESTONE]: {
    id: BlockType.COBBLESTONE,
    name: 'Cobblestone',
    solid: true,
    transparent: false,
    color: [0.45, 0.45, 0.45],
    breakTime: 2.0,
    dropsItem: true,
  },
  [BlockType.GLASS]: {
    id: BlockType.GLASS,
    name: 'Glass',
    solid: true,
    transparent: true,
    color: [0.8, 0.9, 1.0],
    breakTime: 0.3,
    dropsItem: false,
  },
  [BlockType.SNOW]: {
    id: BlockType.SNOW,
    name: 'Snow',
    solid: true,
    transparent: false,
    color: [0.95, 0.95, 0.98],
    breakTime: 0.3,
    dropsItem: true,
  },
};
