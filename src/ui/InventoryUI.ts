import { BLOCK_DEFS } from '../shared/blocks';
import { ITEMS, Inventory, ItemStack } from '../items/ItemRegistry';
import { INVENTORY_SLOTS, HOTBAR_SLOTS } from '../shared/constants';

/**
 * Manages the full inventory screen overlay.
 * Supports viewing and rearranging items in both the 27-slot main grid
 * and the 9-slot hotbar via click-to-swap interaction.
 */
export class InventoryUI {
  private element: HTMLElement;
  private isOpen: boolean = false;
  private inventory: Inventory;

  /** Currently "held" item for swap interaction (click to pick up / put down) */
  private heldItem: ItemStack | null = null;
  private heldSource: { area: 'slots' | 'hotbar'; index: number } | null = null;

  private inventorySlotElements: HTMLElement[] = [];
  private hotbarSlotElements: HTMLElement[] = [];

  constructor(inventory: Inventory) {
    this.element = document.getElementById('inventory-screen')!;
    this.inventory = inventory;
  }

  /**
   * Build the inventory grid and hotbar row DOM elements.
   */
  init(): void {
    const gridContainer =
      document.getElementById('inventory-grid') || this.createSection('inventory-grid');
    const hotbarContainer =
      document.getElementById('inventory-hotbar') || this.createSection('inventory-hotbar');

    gridContainer.innerHTML = '';
    hotbarContainer.innerHTML = '';
    this.inventorySlotElements = [];
    this.hotbarSlotElements = [];

    // 27 main inventory slots
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const slotEl = this.createSlotElement();
      slotEl.dataset.area = 'slots';
      slotEl.dataset.index = String(i);
      slotEl.addEventListener('click', () => this.onSlotClick('slots', i));
      gridContainer.appendChild(slotEl);
      this.inventorySlotElements.push(slotEl);
    }

    // 9 hotbar slots
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slotEl = this.createSlotElement();
      slotEl.dataset.area = 'hotbar';
      slotEl.dataset.index = String(i);
      slotEl.addEventListener('click', () => this.onSlotClick('hotbar', i));
      hotbarContainer.appendChild(slotEl);
      this.hotbarSlotElements.push(slotEl);
    }
  }

  /**
   * Create an inventory slot DOM element.
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
   * Create a section container if it doesn't exist in DOM.
   */
  private createSection(id: string): HTMLElement {
    const section = document.createElement('div');
    section.id = id;
    this.element.appendChild(section);
    return section;
  }

  open(): void {
    this.isOpen = true;
    this.element.style.display = 'flex';
    this.heldItem = null;
    this.heldSource = null;
    this.refresh();
  }

  close(): void {
    // If holding an item, put it back
    if (this.heldItem && this.heldSource) {
      const arr = this.heldSource.area === 'hotbar' ? this.inventory.hotbar : this.inventory.slots;
      arr[this.heldSource.index] = this.heldItem;
    }
    this.heldItem = null;
    this.heldSource = null;
    this.isOpen = false;
    this.element.style.display = 'none';
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  isVisible(): boolean {
    return this.isOpen;
  }

  /**
   * Handle click on an inventory/hotbar slot.
   * Implements click-to-pick-up, click-to-put-down swap mechanic.
   */
  private onSlotClick(area: 'slots' | 'hotbar', index: number): void {
    const arr = area === 'hotbar' ? this.inventory.hotbar : this.inventory.slots;

    if (this.heldItem) {
      // We're holding something — put it down (swap)
      const existing = arr[index];
      arr[index] = this.heldItem;

      if (existing) {
        // Pick up what was there
        this.heldItem = existing;
        this.heldSource = { area, index };
      } else {
        this.heldItem = null;
        this.heldSource = null;
      }
    } else {
      // Nothing held — pick up from this slot
      const stack = arr[index];
      if (stack) {
        this.heldItem = stack;
        this.heldSource = { area, index };
        arr[index] = null;
      }
    }

    this.refresh();
  }

  /**
   * Refresh all slot visuals from current inventory data.
   */
  refresh(): void {
    // Update main inventory slots
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const el = this.inventorySlotElements[i];
      if (el) {
        this.renderSlot(el, this.inventory.slots[i]);
      }
    }

    // Update hotbar slots
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const el = this.hotbarSlotElements[i];
      if (el) {
        this.renderSlot(el, this.inventory.hotbar[i]);
      }
    }
  }

  /**
   * Render the visual content of a single slot element.
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
