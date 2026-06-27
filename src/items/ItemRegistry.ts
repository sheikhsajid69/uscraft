import { BlockType } from '../shared/blocks';
import { HOTBAR_SLOTS, INVENTORY_SLOTS } from '../shared/constants';

/**
 * Definition for a game item — may represent a placeable block,
 * a tool, or a decorative object.
 */
export interface ItemDefinition {
  /** Unique item identifier */
  id: string;
  /** Display name */
  name: string;
  /** If set, placing this item creates the given block type */
  blockType?: BlockType;
  /** Whether this item can stack with identical items */
  stackable: boolean;
  /** Maximum number per stack */
  maxStack: number;
  /** Asset manifest id for 3D representation (tools/special items) */
  glbAsset?: string;
}

/**
 * Master item registry — all items available in the game.
 */
export const ITEMS: Record<string, ItemDefinition> = {
  grass: {
    id: 'grass',
    name: 'Grass Block',
    blockType: BlockType.GRASS,
    stackable: true,
    maxStack: 64,
  },
  dirt: {
    id: 'dirt',
    name: 'Dirt',
    blockType: BlockType.DIRT,
    stackable: true,
    maxStack: 64,
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    blockType: BlockType.STONE,
    stackable: true,
    maxStack: 64,
  },
  wood: {
    id: 'wood',
    name: 'Wood',
    blockType: BlockType.WOOD,
    stackable: true,
    maxStack: 64,
  },
  planks: {
    id: 'planks',
    name: 'Planks',
    blockType: BlockType.PLANKS,
    stackable: true,
    maxStack: 64,
  },
  cobblestone: {
    id: 'cobblestone',
    name: 'Cobblestone',
    blockType: BlockType.COBBLESTONE,
    stackable: true,
    maxStack: 64,
  },
  sand: {
    id: 'sand',
    name: 'Sand',
    blockType: BlockType.SAND,
    stackable: true,
    maxStack: 64,
  },
  glass: {
    id: 'glass',
    name: 'Glass',
    blockType: BlockType.GLASS,
    stackable: true,
    maxStack: 64,
  },
  leaves: {
    id: 'leaves',
    name: 'Leaves',
    blockType: BlockType.LEAVES,
    stackable: true,
    maxStack: 64,
  },
  snow: {
    id: 'snow',
    name: 'Snow',
    blockType: BlockType.SNOW,
    stackable: true,
    maxStack: 64,
  },
  diamond_sword: {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    stackable: false,
    maxStack: 1,
    glbAsset: 'diamond_sword',
  },
  matchlock: {
    id: 'matchlock',
    name: 'Matchlock',
    stackable: false,
    maxStack: 1,
    glbAsset: 'matchlock',
  },
  torch_item: {
    id: 'torch_item',
    name: 'Torch',
    stackable: true,
    maxStack: 64,
    glbAsset: 'torch',
  },
};

/**
 * Represents a stack of identical items in an inventory slot.
 */
export interface ItemStack {
  itemId: string;
  count: number;
}

/**
 * Player inventory with hotbar (9 slots) and main storage (27 slots).
 * Supports stacking, adding, and removing items.
 */
export class Inventory {
  slots: (ItemStack | null)[];
  hotbar: (ItemStack | null)[];

  constructor() {
    this.slots = new Array(INVENTORY_SLOTS).fill(null);
    this.hotbar = new Array(HOTBAR_SLOTS).fill(null);

    // Default starter hotbar — one stack of each common block
    this.hotbar[0] = { itemId: 'grass', count: 64 };
    this.hotbar[1] = { itemId: 'dirt', count: 64 };
    this.hotbar[2] = { itemId: 'stone', count: 64 };
    this.hotbar[3] = { itemId: 'wood', count: 64 };
    this.hotbar[4] = { itemId: 'planks', count: 64 };
    this.hotbar[5] = { itemId: 'cobblestone', count: 64 };
    this.hotbar[6] = { itemId: 'sand', count: 64 };
    this.hotbar[7] = { itemId: 'glass', count: 64 };
    this.hotbar[8] = { itemId: 'leaves', count: 64 };
  }

  /**
   * Try to add items to the inventory.
   * First attempts to stack onto existing matching stacks in the hotbar,
   * then main slots, then fills empty slots.
   *
   * @returns true if all items were added, false if some could not fit
   */
  addItem(itemId: string, count: number): boolean {
    const def = ITEMS[itemId];
    if (!def) return false;

    let remaining = count;

    // Phase 1: try to merge into existing stacks in hotbar
    if (def.stackable) {
      for (let i = 0; i < this.hotbar.length && remaining > 0; i++) {
        const slot = this.hotbar[i];
        if (slot && slot.itemId === itemId) {
          const space = def.maxStack - slot.count;
          const toAdd = Math.min(space, remaining);
          slot.count += toAdd;
          remaining -= toAdd;
        }
      }

      // Phase 2: try to merge into existing stacks in main inventory
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        const slot = this.slots[i];
        if (slot && slot.itemId === itemId) {
          const space = def.maxStack - slot.count;
          const toAdd = Math.min(space, remaining);
          slot.count += toAdd;
          remaining -= toAdd;
        }
      }
    }

    // Phase 3: fill empty hotbar slots
    for (let i = 0; i < this.hotbar.length && remaining > 0; i++) {
      if (!this.hotbar[i]) {
        const toAdd = Math.min(def.maxStack, remaining);
        this.hotbar[i] = { itemId, count: toAdd };
        remaining -= toAdd;
      }
    }

    // Phase 4: fill empty main inventory slots
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const toAdd = Math.min(def.maxStack, remaining);
        this.slots[i] = { itemId, count: toAdd };
        remaining -= toAdd;
      }
    }

    return remaining === 0;
  }

  /**
   * Remove items from a specific hotbar slot.
   *
   * @returns the removed ItemStack (partial or full), or null if slot is empty
   */
  removeFromHotbar(slot: number, count: number): ItemStack | null {
    if (slot < 0 || slot >= this.hotbar.length) return null;

    const stack = this.hotbar[slot];
    if (!stack) return null;

    const removed = Math.min(stack.count, count);
    stack.count -= removed;

    if (stack.count <= 0) {
      this.hotbar[slot] = null;
    }

    return { itemId: stack.itemId, count: removed };
  }

  /**
   * Get the item stack in a given hotbar slot.
   */
  getHotbarItem(slot: number): ItemStack | null {
    if (slot < 0 || slot >= this.hotbar.length) return null;
    return this.hotbar[slot];
  }
}
