<script setup lang="ts">
import { gameStats } from './stats';
import { inventoryState } from './inventoryStore';
import Hotbar from './Hotbar.vue';
import Inventory from './Inventory.vue';
</script>

<template>
  <div class="overlay">
    <!-- Crosshair (hidden when inventory/crafting is open) -->
    <div v-if="!inventoryState.isOpen" class="crosshair">
      <div class="crosshair-h"></div>
      <div class="crosshair-v"></div>
    </div>

    <!-- Debug overlay -->
    <div class="debug">
      <div>FPS: {{ gameStats.fps }}</div>
      <div>Chunks: {{ gameStats.chunkCount }}</div>
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
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-50%);
}

.crosshair-v {
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  transform: translateX(-50%);
}

.debug {
  position: absolute;
  top: 8px;
  left: 8px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  line-height: 1.4;
}
</style>
