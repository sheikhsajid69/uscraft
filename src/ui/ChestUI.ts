import { BLOCK_DEFS } from '../shared/blocks';
import { ITEMS, Inventory, ItemStack } from '../items/ItemRegistry';
import { INVENTORY_SLOTS, HOTBAR_SLOTS } from '../shared/constants';

/**
 * Manages the chest interaction UI screen.
 * Displays 27 chest slots alongside the player's 27 storage + 9 hotbar slots.
 * Clicking a slot transfers its item to the other side.
 */
export class ChestUI {
  private element: HTMLElement;
  private isOpen: boolean = false;
  private chestInventory: (ItemStack | null)[];
  private playerInventory: Inventory;
  private currentChestId: string = '';

  /** Persistent chest storage keyed by chestId */
  private static chestStorage: Map<string, (ItemStack | null)[]> = new Map();

  private chestSlotElements: HTMLElement[] = [];
  private playerSlotElements: HTMLElement[] = [];
  private playerHotbarElements: HTMLElement[] = [];

  constructor(playerInventory: Inventory) {
    this.element = document.getElementById('chest-screen')!;
    this.playerInventory = playerInventory;
    this.chestInventory = new Array(INVENTORY_SLOTS).fill(null);
  }

  /**
   * Open the chest UI for a specific chest.
   * Creates new empty storage if the chest hasn't been opened before.
   */
  open(chestId: string): void {
    this.currentChestId = chestId;

    // Load or create chest storage
    if (ChestUI.chestStorage.has(chestId)) {
      this.chestInventory = ChestUI.chestStorage.get(chestId)!;
    } else {
      this.chestInventory = new Array(INVENTORY_SLOTS).fill(null);
      ChestUI.chestStorage.set(chestId, this.chestInventory);
    }

    this.isOpen = true;
    this.element.style.display = 'flex';
    this.buildUI();
    this.refresh();
  }

  close(): void {
    // Persist chest contents
    if (this.currentChestId) {
      ChestUI.chestStorage.set(this.currentChestId, this.chestInventory);
    }
    this.isOpen = false;
    this.element.style.display = 'none';
  }

  isVisible(): boolean {
    return this.isOpen;
  }

  /**
   * Build the DOM structure for the chest UI.
   */
  private buildUI(): void {
    this.element.innerHTML = '';
    this.chestSlotElements = [];
    this.playerSlotElements = [];
    this.playerHotbarElements = [];

    // Title
    const title = document.createElement('h3');
    title.className = 'chest-title';
    title.textContent = 'Chest';
    this.element.appendChild(title);

    // Chest grid — 27 slots
    const chestGrid = document.createElement('div');
    chestGrid.className = 'chest-grid';
    chestGrid.id = 'chest-grid';
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const slotEl = this.createSlotElement();
      slotEl.addEventListener('click', () => this.onChestSlotClick(i));
      chestGrid.appendChild(slotEl);
      this.chestSlotElements.push(slotEl);
    }
    this.element.appendChild(chestGrid);

    // Separator
    const sep = document.createElement('div');
    sep.className = 'chest-separator';
    this.element.appendChild(sep);

    // Player inventory label
    const playerLabel = document.createElement('h3');
    playerLabel.className = 'chest-title';
    playerLabel.textContent = 'Inventory';
    this.element.appendChild(playerLabel);

    // Player main inventory — 27 slots
    const playerGrid = document.createElement('div');
    playerGrid.className = 'chest-grid';
    playerGrid.id = 'chest-player-grid';
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const slotEl = this.createSlotElement();
      slotEl.addEventListener('click', () => this.onPlayerSlotClick(i));
      playerGrid.appendChild(slotEl);
      this.playerSlotElements.push(slotEl);
    }
    this.element.appendChild(playerGrid);

    // Player hotbar — 9 slots
    const hotbarGrid = document.createElement('div');
    hotbarGrid.className = 'chest-hotbar-grid';
    hotbarGrid.id = 'chest-player-hotbar';
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slotEl = this.createSlotElement();
      slotEl.addEventListener('click', () => this.onPlayerHotbarClick(i));
      hotbarGrid.appendChild(slotEl);
      this.playerHotbarElements.push(slotEl);
    }
    this.element.appendChild(hotbarGrid);
  }

  /**
   * Create a slot DOM element.
   */
  private createSlotElement(): HTMLElement {
    const slot = document.createElement('div');
    slot.className = 'item-slot';

    const preview = document.createElement('div');
    preview.className = 'slot-preview';
    slot.appendChild(preview);

    const count = document.createElement('span');
    count.className = 'slot-count';
    slot.appendChild(count);

    return slot;
  }

  /**
   * Clicking a chest slot transfers its contents to the player inventory.
   */
  private onChestSlotClick(index: number): void {
    const stack = this.chestInventory[index];
    if (!stack) return;

    const added = this.playerInventory.addItem(stack.itemId, stack.count);
    if (added) {
      this.chestInventory[index] = null;
    }
    this.refresh();
  }

  /**
   * Clicking a player main slot transfers its contents to the chest.
   */
  private onPlayerSlotClick(index: number): void {
    const stack = this.playerInventory.slots[index];
    if (!stack) return;

    if (this.addToChest(stack.itemId, stack.count)) {
      this.playerInventory.slots[index] = null;
    }
    this.refresh();
  }

  /**
   * Clicking a player hotbar slot transfers its contents to the chest.
   */
  private onPlayerHotbarClick(index: number): void {
    const stack = this.playerInventory.hotbar[index];
    if (!stack) return;

    if (this.addToChest(stack.itemId, stack.count)) {
      this.playerInventory.hotbar[index] = null;
    }
    this.refresh();
  }

  /**
   * Try to add an item to the chest inventory (stacking + empty slots).
   *
   * @returns true if all items were added
   */
  private addToChest(itemId: string, count: number): boolean {
    const def = ITEMS[itemId];
    if (!def) return false;

    let remaining = count;

    // Stack into existing
    if (def.stackable) {
      for (let i = 0; i < this.chestInventory.length && remaining > 0; i++) {
        const slot = this.chestInventory[i];
        if (slot && slot.itemId === itemId) {
          const space = def.maxStack - slot.count;
          const toAdd = Math.min(space, remaining);
          slot.count += toAdd;
          remaining -= toAdd;
        }
      }
    }

    // Fill empty slots
    for (let i = 0; i < this.chestInventory.length && remaining > 0; i++) {
      if (!this.chestInventory[i]) {
        const toAdd = Math.min(def.maxStack, remaining);
        this.chestInventory[i] = { itemId, count: toAdd };
        remaining -= toAdd;
      }
    }

    return remaining === 0;
  }

  /**
   * Refresh all slot visuals from current data.
   */
  refresh(): void {
    // Chest slots
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const el = this.chestSlotElements[i];
      if (el) this.renderSlot(el, this.chestInventory[i]);
    }

    // Player main inventory
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const el = this.playerSlotElements[i];
      if (el) this.renderSlot(el, this.playerInventory.slots[i]);
    }

    // Player hotbar
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const el = this.playerHotbarElements[i];
      if (el) this.renderSlot(el, this.playerInventory.hotbar[i]);
    }
  }

  /**
   * Render visual content of a single slot.
   */
  private renderSlot(slotEl: HTMLElement, stack: ItemStack | null): void {
    const preview = slotEl.querySelector('.slot-preview') as HTMLElement;
    const countEl = slotEl.querySelector('.slot-count') as HTMLElement;

    if (stack) {
      const itemDef = ITEMS[stack.itemId];

      if (itemDef && itemDef.blockType !== undefined) {
        const blockDef = BLOCK_DEFS[itemDef.blockType as number];
        if (blockDef) {
          const [r, g, b] = blockDef.color;
          preview.style.backgroundColor = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
        } else {
          preview.style.backgroundColor = '#888';
        }
      } else {
        preview.style.backgroundColor = '#aaddff';
      }

      preview.title = itemDef ? itemDef.name : stack.itemId;
      countEl.textContent = stack.count > 1 ? String(stack.count) : '';
    } else {
      preview.style.backgroundColor = 'transparent';
      preview.title = '';
      countEl.textContent = '';
    }
  }
}
