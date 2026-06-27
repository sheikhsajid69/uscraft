import * as THREE from 'three';
import { Renderer } from './engine/Renderer';
import { GameLoop } from './engine/GameLoop';
import { InputManager } from './engine/InputManager';
import { ChunkManager } from './world/ChunkManager';
import { PlayerController } from './player/PlayerController';
import { AssetLoader } from './services/AssetLoader';
import { StructurePlacer } from './world/StructurePlacer';
import { ASSET_MANIFEST, getPreloadAssets } from './assets/manifest';
import { HUD } from './ui/HUD';
import { InventoryUI } from './ui/InventoryUI';
import { ChestUI } from './ui/ChestUI';
import { Inventory } from './items/ItemRegistry';
import { WORLD_SEED } from './shared/constants';
import { DroppedItemManager } from './items/DroppedItem';

// ---- DOM elements ----
const loadingScreen = document.getElementById('loading-screen')!;
const loadingBar = document.getElementById('loading-bar')! as HTMLElement;
const loadingText = document.getElementById('loading-text')!;
const startScreen = document.getElementById('start-screen')!;

// ---- Engine singletons ----
const renderer = new Renderer();
const input = InputManager.getInstance();

const inventory = new Inventory();
const hud = new HUD();
const inventoryUI = new InventoryUI(inventory);
const chestUI = new ChestUI(inventory);
const droppedItemManager = new DroppedItemManager(renderer.scene);
const assetLoader = AssetLoader.getInstance();
const structurePlacer = new StructurePlacer(renderer.scene, assetLoader);

const chunkManager = new ChunkManager(renderer.scene, WORLD_SEED);
const playerController = new PlayerController(renderer.camera, chunkManager, chestUI, structurePlacer);

// Initialize UI
hud.initHotbar();
hud.updateHealth(100, 100);
inventoryUI.init();

// ---- Loading Flow ----
let loadProgress = 0;
function updateProgress(percent: number) {
  loadProgress = percent;
  loadingBar.style.width = `${loadProgress}%`;
  loadingText.textContent = `Loading world… ${Math.floor(loadProgress)}%`;
}

async function loadAssets(): Promise<void> {
  const preload = getPreloadAssets();
  let loadedCount = 0;
  
  await Promise.all(preload.map(async (asset) => {
    await assetLoader.loadWithProgress(asset.filename);
    loadedCount++;
    updateProgress((loadedCount / (preload.length + 3)) * 100);
  }));

  // Load the environment background explicitly (dirt road, temple, selene)
  const dirtRoad = ASSET_MANIFEST.find(a => a.id === 'dirt_road')!;
  await assetLoader.loadWithProgress(dirtRoad.filename, (p) => {
    updateProgress(((loadedCount + p / 100) / (preload.length + 3)) * 100);
  });
  loadedCount++;

  const temple = ASSET_MANIFEST.find(a => a.id === 'temple')!;
  await assetLoader.loadWithProgress(temple.filename, (p) => {
    updateProgress(((loadedCount + p / 100) / (preload.length + 3)) * 100);
  });
  loadedCount++;

  const selene = ASSET_MANIFEST.find(a => a.id === 'selene')!;
  await assetLoader.loadWithProgress(selene.filename, (p) => {
    updateProgress(((loadedCount + p / 100) / (preload.length + 3)) * 100);
  });
  loadedCount++;

  // Place default decorations
  await structurePlacer.placeWorldDecorations();

  // Place environments (dirt road around the spawn area, and temple in the distance)
  await structurePlacer.placeAsset('dirt_road', new THREE.Vector3(0, 24, 0));
  await structurePlacer.placeAsset('temple', new THREE.Vector3(40, 24, -40));
  
  const seleneRot = new THREE.Euler(0, Math.PI, 0);
  await structurePlacer.placeAsset('selene', new THREE.Vector3(-30, 24, -30), seleneRot, 2.0);

  updateProgress(100);
  loadingText.textContent = 'Ready!';
  
  // Wait a moment so user can see it's ready
  await new Promise(r => setTimeout(r, 400));
}

// ---- Game state ----
let playing = false;

function update(dt: number): void {
  if (!playing) return;
  
  playerController.update(dt);
  chunkManager.update(playerController.position.x, playerController.position.z);
  droppedItemManager.update(dt, playerController.position, inventory);

  // Toggle inventory with E key
  if (input.isKeyPressed('KeyE')) {
    if (chestUI.isVisible()) {
      chestUI.close();
      input.lockPointer(document.body);
    } else {
      inventoryUI.toggle();
      if (inventoryUI.isVisible()) {
        input.unlockPointer();
      } else {
        input.lockPointer(document.body);
      }
    }
  }

  hud.updateHotbar(inventory.hotbar, playerController.selectedSlot);
}

function render(): void {
  renderer.render();

  if (playing) {
    const cam = renderer.camera;
    hud.updateDebugInfo({
      fps: gameLoop.fps,
      x: cam.position.x,
      y: cam.position.y,
      z: cam.position.z,
      chunk: `${Math.floor(cam.position.x / 16)},${Math.floor(cam.position.z / 16)}`
    });
  }

  input.update();
}

const gameLoop = new GameLoop(update, render);

// ---- Boot sequence ----
async function boot(): Promise<void> {
  // Ensure chunks generate at start so we don't fall forever if y is high
  chunkManager.update(playerController.position.x, playerController.position.z);
  
  // Dynamic spawn height finding based on chunk data
  for (let y = 63; y > 0; y--) {
    if (chunkManager.getBlock(0, y, 0) !== 0) {
      playerController.position.y = y + 2;
      break;
    }
  }

  await loadAssets();

  loadingScreen.classList.add('fade-out');
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 500);

  startScreen.style.display = 'flex';

  startScreen.addEventListener('click', () => {
    if (!inventoryUI.isVisible() && !chestUI.isVisible()) {
      input.lockPointer(document.body);
    }
    startScreen.style.display = 'none';
    hud.show();
    playing = true;
  });

  gameLoop.start();
}

boot();
