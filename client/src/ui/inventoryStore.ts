import { reactive } from 'vue';
import { BlockId, findMatchingRecipe, BLOCK_DEFS } from '@voxelia/shared';

export interface ItemStack {
  blockId: BlockId;
  count: number;
}

export const inventoryState = reactive({
  isOpen: false,
  nearCraftingTable: false,
  activeSlotIndex: 0,
  hotbar: [
    { blockId: BlockId.COBBLESTONE, count: 64 },
    { blockId: BlockId.DIRT, count: 64 },
    { blockId: BlockId.STONE, count: 64 },
    { blockId: BlockId.WOOD, count: 64 },
    { blockId: BlockId.PLANKS, count: 64 },
    { blockId: BlockId.GLASS, count: 64 },
    { blockId: BlockId.TORCH_BLOCK, count: 64 },
    { blockId: BlockId.SAND, count: 64 },
    { blockId: BlockId.LEAVES, count: 64 },
  ] as (ItemStack | null)[],
  backpack: Array.from({ length: 27 }, () => null) as (ItemStack | null)[],
  craftingGrid: Array.from({ length: 9 }, () => null) as (ItemStack | null)[],
  craftingOutput: null as ItemStack | null,
});

/** Returns active block ID in the selected hotbar slot. */
export function getActiveBlockId(): BlockId {
  const item = inventoryState.hotbar[inventoryState.activeSlotIndex];
  return item && item.count > 0 ? item.blockId : BlockId.AIR;
}

/** Consume 1 item from active hotbar slot upon placement. */
export function consumeActiveItem(): void {
  const item = inventoryState.hotbar[inventoryState.activeSlotIndex];
  if (item) {
    item.count--;
    if (item.count <= 0) {
      inventoryState.hotbar[inventoryState.activeSlotIndex] = null;
    }
  }
}

/** Check crafting recipes whenever crafting grid changes. */
export function updateCraftingOutput(): void {
  const pattern = inventoryState.craftingGrid.map((item) => (item ? item.blockId : null));
  const recipe = findMatchingRecipe(
    pattern,
    3,
    3,
    inventoryState.nearCraftingTable || inventoryState.isOpen
  );

  if (recipe) {
    inventoryState.craftingOutput = {
      blockId: recipe.output.blockId,
      count: recipe.output.count,
    };
  } else {
    inventoryState.craftingOutput = null;
  }
}

/** Perform craft action when clicking output slot. */
export function craftItem(): void {
  if (!inventoryState.craftingOutput) return;

  // Add to hotbar or backpack
  const out = inventoryState.craftingOutput;
  let added = false;
  for (let i = 0; i < 9; i++) {
    const slot = inventoryState.hotbar[i];
    if (slot && slot.blockId === out.blockId && slot.count + out.count <= 64) {
      slot.count += out.count;
      added = true;
      break;
    } else if (!slot) {
      inventoryState.hotbar[i] = { ...out };
      added = true;
      break;
    }
  }

  if (!added) {
    for (let i = 0; i < 27; i++) {
      const slot = inventoryState.backpack[i];
      if (slot && slot.blockId === out.blockId && slot.count + out.count <= 64) {
        slot.count += out.count;
        break;
      } else if (!slot) {
        inventoryState.backpack[i] = { ...out };
        break;
      }
    }
  }

  // Consume 1 from each occupied crafting grid slot
  for (let i = 0; i < 9; i++) {
    const slot = inventoryState.craftingGrid[i];
    if (slot) {
      slot.count--;
      if (slot.count <= 0) {
        inventoryState.craftingGrid[i] = null;
      }
    }
  }

  updateCraftingOutput();
}

/** Get block hex color formatted as CSS string. */
export function getBlockColorHex(blockId: BlockId): string {
  const def = BLOCK_DEFS[blockId];
  if (!def) return '#888888';
  const hex = def.color.toString(16).padStart(6, '0');
  return `#${hex}`;
}

/** Get block display name. */
export function getBlockName(blockId: BlockId): string {
  const def = BLOCK_DEFS[blockId];
  return def ? def.name : 'Unknown';
}
