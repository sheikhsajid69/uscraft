<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { inventoryState, getBlockColorHex, getBlockName } from './inventoryStore';

function selectSlot(index: number) {
  inventoryState.activeSlotIndex = index;
}

function handleKeyDown(e: KeyboardEvent) {
  if (inventoryState.isOpen) return;
  if (e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key, 10) - 1;
    selectSlot(idx);
  }
}

function handleWheel(e: WheelEvent) {
  if (inventoryState.isOpen) return;
  if (e.deltaY > 0) {
    inventoryState.activeSlotIndex = (inventoryState.activeSlotIndex + 1) % 9;
  } else if (e.deltaY < 0) {
    inventoryState.activeSlotIndex = (inventoryState.activeSlotIndex + 8) % 9;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('wheel', handleWheel);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('wheel', handleWheel);
});
</script>

<template>
  <div class="hotbar-container">
    <div
      v-for="(slot, index) in inventoryState.hotbar"
      :key="index"
      class="hotbar-slot"
      :class="{ active: index === inventoryState.activeSlotIndex }"
      @click="selectSlot(index)"
    >
      <div class="slot-number">{{ index + 1 }}</div>
      <div
        v-if="slot"
        class="block-icon"
        :style="{ backgroundColor: getBlockColorHex(slot.blockId) }"
        :title="getBlockName(slot.blockId)"
      ></div>
      <div v-if="slot && slot.count > 1" class="item-count">{{ slot.count }}</div>
    </div>
  </div>
</template>

<style scoped>
.hotbar-container {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  background: rgba(20, 20, 20, 0.85);
  padding: 6px;
  border: 3px solid #333;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  pointer-events: auto;
  z-index: 20;
}

.hotbar-slot {
  position: relative;
  width: 48px;
  height: 48px;
  background: #2a2a2a;
  border: 2px solid #444;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.hotbar-slot.active {
  border-color: #f0c040;
  background: #383838;
  transform: scale(1.06);
  box-shadow: 0 0 8px rgba(240, 192, 64, 0.8);
}

.slot-number {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 10px;
  color: #888;
  font-family: monospace;
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
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  text-shadow: 1px 1px 2px #000;
  font-family: monospace;
}
</style>
