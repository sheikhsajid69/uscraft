<script setup lang="ts">
import { computed } from 'vue';
import { gameStats } from './stats';
import { inventoryState } from './inventoryStore';
import Hotbar from './Hotbar.vue';
import Inventory from './Inventory.vue';

const hearts = computed(() => {
  const list = [];
  for (let i = 0; i < 10; i++) {
    const val = gameStats.health - i * 2;
    if (val >= 2) list.push('full');
    else if (val === 1) list.push('half');
    else list.push('empty');
  }
  return list;
});

const hungerIcons = computed(() => {
  const list = [];
  for (let i = 0; i < 10; i++) {
    const val = gameStats.hunger - i * 2;
    if (val >= 2) list.push('full');
    else if (val === 1) list.push('half');
    else list.push('empty');
  }
  return list;
});
</script>

<template>
  <div class="overlay">
    <!-- Red screen damage vignette -->
    <div v-if="gameStats.hurtTimer > 0" class="damage-vignette"></div>

    <!-- Crosshair (hidden when inventory/crafting is open) -->
    <div v-if="!inventoryState.isOpen" class="crosshair">
      <div class="crosshair-h"></div>
      <div class="crosshair-v"></div>
    </div>

    <!-- Interaction prompt -->
    <div v-if="gameStats.interactionPrompt && !inventoryState.isOpen" class="interaction-prompt">
      {{ gameStats.interactionPrompt }}
    </div>

    <!-- Debug overlay -->
    <div class="debug">
      <div>FPS: {{ gameStats.fps }}</div>
      <div>Chunks: {{ gameStats.chunkCount }}</div>
      <div v-if="inventoryState.nearCraftingTable" class="table-tag">Near Crafting Table (3×3)</div>
    </div>

    <!-- Vitals Bars: Health & Hunger -->
    <div class="vitals-container" v-if="!inventoryState.isOpen">
      <!-- Health Hearts -->
      <div class="hearts-row">
        <span v-for="(h, idx) in hearts" :key="'h_' + idx" class="heart-icon" :class="h">
          {{ h === 'empty' ? '🖤' : '❤️' }}
        </span>
      </div>

      <!-- Hunger Drumsticks -->
      <div class="hunger-row">
        <span v-for="(u, idx) in hungerIcons" :key="'u_' + idx" class="hunger-icon" :class="u">
          {{ u === 'empty' ? '⚪' : '🍗' }}
        </span>
      </div>
    </div>

    <!-- Gameplay UI -->
    <Hotbar />
    <Inventory />
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 10;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.damage-vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, transparent 40%, rgba(220, 20, 20, 0.45) 90%);
  pointer-events: none;
  animation: pulse 0.3s infinite alternate;
}

@keyframes pulse {
  from { opacity: 0.7; }
  to { opacity: 1; }
}

.crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
}

.crosshair-h {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 2px;
  background: rgba(255, 255, 255, 0.85);
  transform: translateY(-50%);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}

.crosshair-v {
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: 100%;
  background: rgba(255, 255, 255, 0.85);
  transform: translateX(-50%);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}

.interaction-prompt {
  position: absolute;
  top: 58%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 20, 20, 0.75);
  border: 1px solid rgba(240, 192, 64, 0.6);
  color: #f0c040;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.debug {
  position: absolute;
  top: 8px;
  left: 8px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  line-height: 1.4;
}

.table-tag {
  color: #f0c040;
  font-weight: bold;
  margin-top: 2px;
}

.vitals-container {
  position: absolute;
  bottom: 84px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: space-between;
  width: 480px;
  max-width: 90vw;
  font-size: 14px;
  filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.9));
}

.hearts-row, .hunger-row {
  display: flex;
  gap: 2px;
}

.heart-icon.empty, .hunger-icon.empty {
  opacity: 0.35;
}
</style>
