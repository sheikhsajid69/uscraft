<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  inventoryState,
  updateCraftingOutput,
  craftItem,
  getBlockColorHex,
  getBlockName,
  type ItemStack,
} from './inventoryStore';

interface SelectedRef {
  type: 'hotbar' | 'backpack' | 'crafting';
  index: number;
}

const selected = ref<SelectedRef | null>(null);

function getSlot(type: 'hotbar' | 'backpack' | 'crafting', index: number): ItemStack | null {
  if (type === 'hotbar') return inventoryState.hotbar[index];
  if (type === 'backpack') return inventoryState.backpack[index];
  return inventoryState.craftingGrid[index];
}

function setSlot(type: 'hotbar' | 'backpack' | 'crafting', index: number, item: ItemStack | null) {
  if (type === 'hotbar') inventoryState.hotbar[index] = item;
  else if (type === 'backpack') inventoryState.backpack[index] = item;
  else inventoryState.craftingGrid[index] = item;
  if (type === 'crafting') updateCraftingOutput();
}

function handleSlotClick(type: 'hotbar' | 'backpack' | 'crafting', index: number) {
  // If 2x2 mode and slot is outside 0,1, 3,4, disable
  if (type === 'crafting' && !inventoryState.nearCraftingTable) {
    if (index === 2 || index === 5 || index >= 6) return;
  }

  if (!selected.value) {
    const item = getSlot(type, index);
    if (item) {
      selected.value = { type, index };
    }
  } else {
    if (selected.value.type === type && selected.value.index === index) {
      selected.value = null; // deselect
      return;
    }
    const itemA = getSlot(selected.value.type, selected.value.index);
    const itemB = getSlot(type, index);

    // Swap or stack
    if (itemA && itemB && itemA.blockId === itemB.blockId && itemB.count + itemA.count <= 64) {
      itemB.count += itemA.count;
      setSlot(selected.value.type, selected.value.index, null);
      if (type === 'crafting' || selected.value.type === 'crafting') updateCraftingOutput();
    } else {
      setSlot(selected.value.type, selected.value.index, itemB);
      setSlot(type, index, itemA);
    }
    selected.value = null;
  }
}

function handleCraftClick() {
  if (inventoryState.craftingOutput) {
    craftItem();
  }
}

function closeInventory() {
  inventoryState.isOpen = false;
  selected.value = null;
  // If we close, move items in crafting grid back to inventory
  for (let i = 0; i < 9; i++) {
    const item = inventoryState.craftingGrid[i];
    if (item) {
      // Find empty slot in hotbar or backpack
      let moved = false;
      for (let j = 0; j < 9; j++) {
        if (!inventoryState.hotbar[j]) {
          inventoryState.hotbar[j] = item;
          moved = true;
          break;
        }
      }
      if (!moved) {
        for (let j = 0; j < 27; j++) {
          if (!inventoryState.backpack[j]) {
            inventoryState.backpack[j] = item;
            break;
          }
        }
      }
      inventoryState.craftingGrid[i] = null;
    }
  }
  updateCraftingOutput();
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'e' || e.key === 'E' || e.key === 'Tab') {
    e.preventDefault();
    if (inventoryState.isOpen) {
      closeInventory();
    } else {
      inventoryState.isOpen = true;
      document.exitPointerLock?.();
    }
  } else if (e.key === 'Escape' && inventoryState.isOpen) {
    closeInventory();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div v-if="inventoryState.isOpen" class="inventory-backdrop" @click.self="closeInventory">
    <div class="inventory-modal">
      <div class="modal-header">
        <h2>{{ inventoryState.nearCraftingTable ? 'Crafting Table (3×3)' : 'Player Inventory & Crafting (2×2)' }}</h2>
        <button class="close-btn" @click="closeInventory">✕</button>
      </div>

      <div class="inventory-body">
        <!-- Left: Crafting Area -->
        <div class="crafting-section">
          <h3>Crafting Grid</h3>
          <div class="crafting-container">
            <div
              class="crafting-grid"
              :class="{ 'grid-3x3': inventoryState.nearCraftingTable, 'grid-2x2': !inventoryState.nearCraftingTable }"
            >
              <div
                v-for="(slot, idx) in inventoryState.craftingGrid"
                :key="idx"
                class="slot"
                :class="{
                  disabled: !inventoryState.nearCraftingTable && (idx === 2 || idx === 5 || idx >= 6),
                  selected: selected && selected.type === 'crafting' && selected.index === idx
                }"
                @click="handleSlotClick('crafting', idx)"
              >
                <div
                  v-if="slot"
                  class="block-icon"
                  :style="{ backgroundColor: getBlockColorHex(slot.blockId) }"
                  :title="getBlockName(slot.blockId)"
                ></div>
                <div v-if="slot && slot.count > 1" class="item-count">{{ slot.count }}</div>
              </div>
            </div>

            <div class="craft-arrow">➔</div>

            <div class="slot output-slot" @click="handleCraftClick">
              <div
                v-if="inventoryState.craftingOutput"
                class="block-icon"
                :style="{ backgroundColor: getBlockColorHex(inventoryState.craftingOutput.blockId) }"
                :title="getBlockName(inventoryState.craftingOutput.blockId)"
              ></div>
              <div
                v-if="inventoryState.craftingOutput && inventoryState.craftingOutput.count > 1"
                class="item-count"
              >
                {{ inventoryState.craftingOutput.count }}
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Backpack & Hotbar -->
        <div class="storage-section">
          <h3>Backpack</h3>
          <div class="grid backpack-grid">
            <div
              v-for="(slot, idx) in inventoryState.backpack"
              :key="idx"
              class="slot"
              :class="{ selected: selected && selected.type === 'backpack' && selected.index === idx }"
              @click="handleSlotClick('backpack', idx)"
            >
              <div
                v-if="slot"
                class="block-icon"
                :style="{ backgroundColor: getBlockColorHex(slot.blockId) }"
                :title="getBlockName(slot.blockId)"
              ></div>
              <div v-if="slot && slot.count > 1" class="item-count">{{ slot.count }}</div>
            </div>
          </div>

          <h3 class="hotbar-label">Hotbar</h3>
          <div class="grid hotbar-grid">
            <div
              v-for="(slot, idx) in inventoryState.hotbar"
              :key="idx"
              class="slot"
              :class="{ selected: selected && selected.type === 'hotbar' && selected.index === idx }"
              @click="handleSlotClick('hotbar', idx)"
            >
              <div class="slot-number">{{ idx + 1 }}</div>
              <div
                v-if="slot"
                class="block-icon"
                :style="{ backgroundColor: getBlockColorHex(slot.blockId) }"
                :title="getBlockName(slot.blockId)"
              ></div>
              <div v-if="slot && slot.count > 1" class="item-count">{{ slot.count }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inventory-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: auto;
  font-family: sans-serif;
}

.inventory-modal {
  background: #2a2a2a;
  border: 4px solid #444;
  border-radius: 8px;
  width: 760px;
  max-width: 95vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  color: #eee;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #1f1f1f;
  border-bottom: 2px solid #3f3f3f;
  border-radius: 4px 4px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: #f0c040;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 20px;
  cursor: pointer;
}

.close-btn:hover {
  color: #fff;
}

.inventory-body {
  display: flex;
  padding: 20px;
  gap: 24px;
}

.crafting-section,
.storage-section {
  display: flex;
  flex-direction: column;
}

.crafting-section {
  flex: 1;
  border-right: 2px solid #3c3c3c;
  padding-right: 24px;
}

.storage-section {
  flex: 1.6;
}

h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #bbb;
}

.hotbar-label {
  margin-top: 16px;
}

.crafting-container {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.crafting-grid {
  display: grid;
  grid-template-columns: repeat(3, 46px);
  grid-template-rows: repeat(3, 46px);
  gap: 6px;
}

.craft-arrow {
  font-size: 24px;
  color: #888;
}

.grid {
  display: grid;
  grid-template-columns: repeat(9, 46px);
  gap: 6px;
}

.slot {
  position: relative;
  width: 46px;
  height: 46px;
  background: #1f1f1f;
  border: 2px solid #3d3d3d;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.1s;
}

.slot:hover:not(.disabled) {
  border-color: #666;
  background: #252525;
}

.slot.selected {
  border-color: #f0c040;
  background: #333;
  box-shadow: 0 0 8px rgba(240, 192, 64, 0.6);
}

.slot.disabled {
  background: #151515;
  border-color: #222;
  cursor: not-allowed;
  opacity: 0.3;
}

.output-slot {
  width: 54px;
  height: 54px;
  border-color: #555;
  background: #222;
}

.block-icon {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 3px;
  box-shadow: inset 2px 2px 4px rgba(255, 255, 255, 0.25), inset -2px -2px 4px rgba(0, 0, 0, 0.4);
}

.item-count {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 11px;
  font-weight: bold;
  color: #fff;
  text-shadow: 1px 1px 2px #000;
  font-family: monospace;
}

.slot-number {
  position: absolute;
  top: 2px;
  left: 3px;
  font-size: 9px;
  color: #666;
  font-family: monospace;
}
</style>
