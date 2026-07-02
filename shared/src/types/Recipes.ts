import { BlockId } from "./Block.js";

export interface RecipeIngredient {
  readonly blockId: BlockId;
  readonly count?: number;
}

export interface CraftingRecipe {
  readonly id: string;
  readonly name: string;
  /** Width of the recipe grid (1, 2, or 3) */
  readonly width: number;
  /** Height of the recipe grid (1, 2, or 3) */
  readonly height: number;
  /**
   * Flat array of ingredients row by row. null means an empty slot.
   * Length must equal width * height.
   */
  readonly pattern: readonly (BlockId | null)[];
  /** Output produced by this recipe */
  readonly output: {
    readonly blockId: BlockId;
    readonly count: number;
  };
  /** Whether this recipe requires a 3x3 crafting bench (bench_minecraft.glb) */
  readonly requiresCraftingTable: boolean;
}

export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [
  {
    id: "wood_to_planks",
    name: "Planks",
    width: 1,
    height: 1,
    pattern: [BlockId.WOOD],
    output: {
      blockId: BlockId.PLANKS,
      count: 4,
    },
    requiresCraftingTable: false,
  },
  {
    id: "planks_to_crafting_table",
    name: "Crafting Table",
    width: 2,
    height: 2,
    pattern: [BlockId.PLANKS, BlockId.PLANKS, BlockId.PLANKS, BlockId.PLANKS],
    output: {
      blockId: BlockId.COBBLESTONE,
      count: 1,
    },
    requiresCraftingTable: false,
  },
  {
    id: "wood_planks_to_torch",
    name: "Torch",
    width: 1,
    height: 2,
    pattern: [BlockId.WOOD, BlockId.PLANKS],
    output: {
      blockId: BlockId.TORCH_BLOCK,
      count: 4,
    },
    requiresCraftingTable: false,
  },
  {
    id: "cobblestone_ring_to_stone",
    name: "Stone",
    width: 3,
    height: 3,
    pattern: [
      BlockId.COBBLESTONE, BlockId.COBBLESTONE, BlockId.COBBLESTONE,
      BlockId.COBBLESTONE, null, BlockId.COBBLESTONE,
      BlockId.COBBLESTONE, BlockId.COBBLESTONE, BlockId.COBBLESTONE,
    ],
    output: {
      blockId: BlockId.STONE,
      count: 8,
    },
    requiresCraftingTable: true,
  },
  {
    id: "glass_wood_to_glass",
    name: "Glass",
    width: 3,
    height: 3,
    pattern: [
      BlockId.GLASS, BlockId.GLASS, BlockId.GLASS,
      BlockId.GLASS, BlockId.GLASS, BlockId.GLASS,
      BlockId.WOOD, BlockId.WOOD, BlockId.WOOD,
    ],
    output: {
      blockId: BlockId.GLASS,
      count: 4,
    },
    requiresCraftingTable: true,
  },
  {
    id: "stone_pickaxe_to_cobblestone",
    name: "Cobblestone",
    width: 3,
    height: 3,
    pattern: [
      BlockId.STONE, BlockId.STONE, BlockId.STONE,
      null, BlockId.PLANKS, null,
      null, BlockId.PLANKS, null,
    ],
    output: {
      blockId: BlockId.COBBLESTONE,
      count: 1,
    },
    requiresCraftingTable: true,
  },
];

export interface NormalizedGrid {
  readonly width: number;
  readonly height: number;
  readonly pattern: readonly (BlockId | null)[];
}

/**
 * Trim empty rows and columns around the bounding box of non-null items in a grid.
 * Returns null if the grid is completely empty or dimensions are invalid.
 */
export function normalizeGrid(
  grid: readonly (BlockId | null)[],
  width: number,
  height: number
): NormalizedGrid | null {
  if (width <= 0 || height <= 0 || grid.length !== width * height) {
    return null;
  }

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const item = grid[y * width + x];
      if (item !== null && item !== undefined) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) {
    return null;
  }

  const newWidth = maxX - minX + 1;
  const newHeight = maxY - minY + 1;
  const newPattern: (BlockId | null)[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const item = grid[y * width + x];
      newPattern.push(item !== undefined && item !== null ? item : null);
    }
  }

  return {
    width: newWidth,
    height: newHeight,
    pattern: newPattern,
  };
}

/**
 * Try to match an input grid (width x height array of BlockId | null) against known recipes.
 * Returns the matching recipe or null if no match.
 */
export function findMatchingRecipe(
  grid: readonly (BlockId | null)[],
  gridWidth: number,
  gridHeight: number,
  hasCraftingTable: boolean
): CraftingRecipe | null {
  const normInput = normalizeGrid(grid, gridWidth, gridHeight);
  if (!normInput) {
    return null;
  }

  // Without a crafting table, players cannot craft recipes larger than 2x2
  if (!hasCraftingTable && (normInput.width > 2 || normInput.height > 2)) {
    return null;
  }

  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.requiresCraftingTable && !hasCraftingTable) {
      continue;
    }

    const normRecipe = normalizeGrid(recipe.pattern, recipe.width, recipe.height);
    if (!normRecipe) {
      continue;
    }

    if (
      normInput.width === normRecipe.width &&
      normInput.height === normRecipe.height &&
      normInput.pattern.length === normRecipe.pattern.length
    ) {
      let isMatch = true;
      for (let i = 0; i < normInput.pattern.length; i++) {
        if (normInput.pattern[i] !== normRecipe.pattern[i]) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        return recipe;
      }
    }
  }

  return null;
}
