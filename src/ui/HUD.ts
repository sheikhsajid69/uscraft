import { BLOCK_DEFS } from '../shared/blocks';
import { ITEMS, ItemStack } from '../items/ItemRegistry';
import { HOTBAR_SLOTS } from '../shared/constants';

/**
 * Manages the in-game HUD overlay:
 * crosshair, hotbar, health bar, and debug information.
 */
export class HUD {
  private hudElement: HTMLElement;
  private hotbarElement: HTMLElement;
  private healthFill: HTMLElement;
  private debugInfo: HTMLElement;
  private hotbarSlots: HTMLElement[];

  constructor() {
    this.hudElement = document.getElementById('hud')!;
    this.hotbarElement = document.getElementById('hotbar')!;
    this.healthFill = document.getElementById('health-fill')!;
    this.debugInfo = document.getElementById('debug-info')!;
    this.hotbarSlots = [];
  }

  /**
   * Show the entire HUD overlay.
   */
  show(): void {
    this.hudElement.style.display = '';
  }

  /**
   * Hide the entire HUD overlay.
   */
  hide(): void {
    this.hudElement.style.display = 'none';
  }

  /**
   * Set HUD visibility.
   */
  setVisible(visible: boolean): void {
    if (visible) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Build the 9 hotbar slot DOM elements inside #hotbar.
   * Each slot has a slot number, a colored block preview square,
   * and a stack count label.
   */
  initHotbar(): void {
    this.hotbarElement.innerHTML = '';
    this.hotbarSlots = [];

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.dataset.slot = String(i);

      // Slot number label (1-9) in top-left corner
      const numLabel = document.createElement('span');
      numLabel.className = 'slot-number';
      numLabel.textContent = String(i + 1);
      slot.appendChild(numLabel);

      // Colored block preview square
      const preview = document.createElement('div');
      preview.className = 'slot-preview';
      slot.appendChild(preview);

      // Stack count in bottom-right
      const countLabel = document.createElement('span');
      countLabel.className = 'slot-count';
      slot.appendChild(countLabel);

      this.hotbarElement.appendChild(slot);
      this.hotbarSlots.push(slot);
    }
  }

  /**
   * Update all hotbar slot visuals and selection highlight.
   *
   * @param hotbarItems  — array of 9 (ItemStack | null)
   * @param selectedSlot — index of the currently selected slot
   */
  updateHotbar(hotbarItems: (ItemStack | null)[], selectedSlot: number): void {
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot) continue;

      const preview = slot.querySelector('.slot-preview') as HTMLElement;
      const countLabel = slot.querySelector('.slot-count') as HTMLElement;

      // Highlight selected slot
      if (i === selectedSlot) {
        slot.classList.add('selected');
      } else {
        slot.classList.remove('selected');
      }

      const stack = hotbarItems[i];
      if (stack) {
        const itemDef = ITEMS[stack.itemId];

        // Determine block color for preview square
        if (itemDef && itemDef.blockType !== undefined) {
          const blockDef = BLOCK_DEFS[itemDef.blockType as number];
          if (blockDef) {
            const [r, g, b] = blockDef.color;
            const hex = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
            preview.style.backgroundColor = hex;
          } else {
            preview.style.backgroundColor = '#888';
          }
        } else {
          // Non-block items get a distinct color
          preview.style.backgroundColor = '#aaddff';
        }

        preview.title = itemDef ? itemDef.name : stack.itemId;
        preview.style.display = '';
        countLabel.textContent = stack.count > 1 ? String(stack.count) : '';
      } else {
        preview.style.backgroundColor = 'transparent';
        preview.title = '';
        preview.style.display = '';
        countLabel.textContent = '';
      }
    }
  }

  /**
   * Update the health bar fill width.
   *
   * @param current — current health
   * @param max     — maximum health
   */
  updateHealth(current: number, max: number): void {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.healthFill.style.width = `${pct}%`;
  }

  /**
   * Update the debug information panel.
   */
  updateDebugInfo(info: {
    fps: number;
    x: number;
    y: number;
    z: number;
    chunk: string;
  }): void {
    this.debugInfo.textContent = [
      `FPS: ${info.fps}`,
      `XYZ: ${info.x.toFixed(1)} / ${info.y.toFixed(1)} / ${info.z.toFixed(1)}`,
      `Chunk: ${info.chunk}`,
    ].join('\n');
  }
}
