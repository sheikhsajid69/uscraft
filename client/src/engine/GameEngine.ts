import { PointLight, Vector3 } from 'three';
import { GameRenderer } from './Renderer';
import { InputController } from './InputController';
import { FlyCamera } from './FlyCamera';
import { PlayerController } from './PlayerController';
import { ChunkManager, setAnchorBounds, queryTerrainHeight } from './ChunkManager';
import { AssetLoader } from './AssetLoader';
import { SkySystem } from './Sky';
import { gameStats } from '../ui/stats';
import { audio } from './AudioSystem';
import { ParticleSystem } from './ParticleSystem';
import { BlockInteraction } from './BlockInteraction';
import { NetworkClient } from './NetworkClient';
import { MobSystem } from './MobSystem';
import { HeldItemSystem } from './HeldItemSystem';
import { inventoryState } from '../ui/inventoryStore';

/**
 * Top-level orchestrator that wires the renderer, camera, input, chunk
 * system, asset loader, sky system, and player controller into one
 * cohesive game loop.
 */
export class GameEngine {
  private readonly renderer: GameRenderer;
  private readonly input: InputController;
  private readonly flyCamera: FlyCamera;
  private readonly playerController: PlayerController;
  private readonly chunkManager: ChunkManager;
  private readonly assetLoader: AssetLoader;
  private readonly sky: SkySystem;
  private readonly particles: ParticleSystem;
  private readonly interaction: BlockInteraction;
  private readonly network: NetworkClient;
  private readonly mobs: MobSystem;
  private readonly heldItems: HeldItemSystem;

  // Camera mode: 'player' (default) or 'fly' (debug, toggled with F3)
  private cameraMode: 'player' | 'fly' = 'player';

  // Day/night cycle: 0–1 over 600 seconds (10 min real time = 1 game day)
  private worldTime = 0.45; // Start at bright midday sunlight
  private static readonly DAY_DURATION = 600;

  // FPS tracking
  private frameCount = 0;
  private fpsTimer = 0;

  constructor() {
    this.renderer = new GameRenderer();
    this.input = new InputController();
    this.flyCamera = new FlyCamera(this.renderer.camera, this.input);
    this.playerController = new PlayerController(
      this.renderer.camera,
      this.input,
      this.renderer.scene,
      queryTerrainHeight,
    );
    this.chunkManager = new ChunkManager(this.renderer.scene);
    this.assetLoader = new AssetLoader();
    this.sky = new SkySystem(this.renderer.scene);
    this.particles = new ParticleSystem(this.renderer.scene);
    this.network = new NetworkClient(this.renderer.scene, this.chunkManager, this.playerController);
    this.mobs = new MobSystem(
      this.renderer.scene,
      this.chunkManager,
      this.playerController,
      this.particles
    );
    this.heldItems = new HeldItemSystem(this.renderer.camera, this.assetLoader);

    this.interaction = new BlockInteraction(
      this.renderer.scene,
      this.chunkManager,
      this.playerController,
      this.input,
      audio,
      this.particles,
      this.network,
      this.mobs,
      this.heldItems
    );

    this.interaction.onSleepCallback = () => {
      this.worldTime = 0.25; // Skip to dawn
      gameStats.health = gameStats.maxHealth; // Rest heals player
    };
  }

  /**
   * Async initialisation: loads anchor terrain, landmarks, and camp props.
   */
  public async init(): Promise<void> {
    // ── 1. Anchor Terrain ────────────────────────────────────────────────
    try {
      const result = await this.assetLoader.loadAnchorTerrain();
      const { model, bbox, baseY } = result;

      setAnchorBounds(
        bbox.min.x, bbox.max.x,
        bbox.min.z, bbox.max.z,
        baseY,
      );
      this.chunkManager.clearAll();
      const pos = this.playerController.getPosition();
      pos.y = Math.max(pos.y, baseY + 2);

      this.renderer.scene.add(model);
      console.log(`[GameEngine] Anchor loaded at baseY=${baseY.toFixed(1)}`);
    } catch (err) {
      console.warn('[GameEngine] Failed to load anchor terrain:', err);
    }

    // ── 2. Multiplayer Connect ───────────────────────────────────────────
    try {
      this.network.connect('http://localhost:3001');
    } catch (err) {
      console.warn('[GameEngine] Failed to connect to multiplayer server:', err);
    }

    // ── 3. Crafting Table (bench_minecraft.glb) ──────────────────────────
    try {
      const bench = await this.assetLoader.loadModel('bench_minecraft.glb');
      const by = queryTerrainHeight(2, 2);
      bench.position.set(2, by, 2);
      this.renderer.scene.add(bench);
      this.interaction.registerInteractiveProp({
        id: 'bench_1',
        type: 'workbench',
        position: new Vector3(2, by, 2),
        object: bench,
        radius: 1.5,
      });
    } catch (err) {
      console.warn('[GameEngine] Failed to load crafting bench model:', err);
    }

    // ── 4. Storage Chest (minecraft_chest.glb) ────────────────────────────
    try {
      const chest = await this.assetLoader.loadModel('minecraft_chest.glb');
      const cy = queryTerrainHeight(4, 2);
      chest.position.set(4, cy, 2);
      chest.scale.setScalar(0.9);
      this.renderer.scene.add(chest);
      this.interaction.registerInteractiveProp({
        id: 'chest_1',
        type: 'chest',
        position: new Vector3(4, cy, 2),
        object: chest,
        radius: 1.5,
      });
    } catch (err) {
      console.warn('[GameEngine] Failed to load chest model:', err);
    }

    // ── 5. Bed (bed_minecraft.glb) ────────────────────────────────────────
    try {
      const bed = await this.assetLoader.loadModel('bed_minecraft.glb');
      const by = queryTerrainHeight(-2, 2);
      bed.position.set(-2, by, 2);
      this.renderer.scene.add(bed);
      this.interaction.registerInteractiveProp({
        id: 'bed_1',
        type: 'bed',
        position: new Vector3(-2, by, 2),
        object: bed,
        radius: 1.8,
      });
    } catch (err) {
      console.warn('[GameEngine] Failed to load bed model:', err);
    }

    // ── 6. Torches & Road Lights (minecraft_torch.glb) ─────────────────────
    try {
      const torchOffsets = [
        [0, 5],
        [0, -5],
        [6, 0],
        [-6, 0],
      ];
      for (const [tx, tz] of torchOffsets) {
        const torch = await this.assetLoader.loadModel('minecraft_torch.glb');
        const ty = queryTerrainHeight(tx, tz);
        torch.position.set(tx, ty, tz);
        torch.scale.setScalar(0.7);
        this.renderer.scene.add(torch);

        const torchLight = new PointLight(0xff9922, 1.2, 14);
        torchLight.position.set(tx, ty + 1.2, tz);
        this.renderer.scene.add(torchLight);
      }
    } catch (err) {
      console.warn('[GameEngine] Failed to load torch models:', err);
    }

    // ── 7. Motorcycle Vehicle (harley_styled_motorcycle_-_minecraft.glb) ───
    try {
      const moto = await this.assetLoader.loadModel('harley_styled_motorcycle_-_minecraft.glb');
      const my = queryTerrainHeight(0, -6);
      moto.position.set(0, my, -6);
      moto.scale.setScalar(0.85);
      this.renderer.scene.add(moto);
    } catch (err) {
      console.warn('[GameEngine] Failed to load motorcycle model:', err);
    }

    // ── 8. Greek Temple Landmark (greek_temple_scan.glb) ───────────────────
    try {
      const temple = await this.assetLoader.loadModel('greek_temple_scan.glb');
      const ty = queryTerrainHeight(80, 80);
      temple.position.set(80, ty, 80);
      temple.scale.setScalar(0.6);
      this.renderer.scene.add(temple);

      // Selene Shrine Altar inside the Temple
      const selene = await this.assetLoader.loadModel('figure_embodying_selene_-_the_moon_goddess.glb');
      selene.position.set(80, ty + 0.5, 80);
      selene.scale.setScalar(0.5);
      this.renderer.scene.add(selene);

      this.interaction.registerInteractiveProp({
        id: 'selene_altar',
        type: 'altar',
        position: new Vector3(80, ty + 0.5, 80),
        object: selene,
        radius: 3.0,
      });
    } catch (err) {
      console.warn('[GameEngine] Failed to load Greek Temple or Selene models:', err);
    }

    // ── 9. Procedural 3D Trees (minecraft_tree.glb) ───────────────────────
    try {
      const treeOffsets = [
        [15, 12],
        [-18, 16],
        [22, -18],
        [-14, -22],
        [28, 5],
        [-25, -8],
        [10, 25],
        [-12, 28],
        [32, -12],
        [-30, 18],
        [18, -32],
        [-22, -28],
      ];
      for (const [tx, tz] of treeOffsets) {
        const tree = await this.assetLoader.loadModel('minecraft_tree.glb');
        const ty = queryTerrainHeight(tx, tz);
        tree.position.set(tx, ty, tz);
        tree.scale.setScalar(1.1 + (Math.random() - 0.5) * 0.4);
        this.renderer.scene.add(tree);
      }
    } catch (err) {
      console.warn('[GameEngine] Failed to load procedural trees:', err);
    }

    // ── 10. Minecraft Grass Blocks (minecraft_grass_block.glb) ────────────
    try {
      const grassBlockOffsets = [
        [1, 1],
        [3, 1],
        [-1, 1],
        [0, 2],
        [0, -2],
      ];
      for (const [gx, gz] of grassBlockOffsets) {
        const gb = await this.assetLoader.loadModel('minecraft_grass_block.glb');
        const gy = queryTerrainHeight(gx, gz);
        gb.position.set(gx, gy, gz);
        gb.scale.setScalar(1.0);
        this.renderer.scene.add(gb);
      }
    } catch (err) {
      console.warn('[GameEngine] Failed to load minecraft_grass_block.glb:', err);
    }
  }

  /**
   * Per-frame update: sky, camera, player, held items, mobs, chunks.
   */
  public update(dt: number): void {
    // ── Day/night cycle ──────────────────────────────────────────────────
    this.worldTime += dt / GameEngine.DAY_DURATION;
    if (this.worldTime >= 1) this.worldTime -= 1;

    const skyState = this.sky.update(this.worldTime, this.renderer.camera.position);

    // Update renderer fog/background to match sky
    this.renderer.updateFogColor(skyState.horizonColor);

    // Update sun light intensity and direction
    this.renderer.sunLight.intensity = skyState.lightIntensity * 1.2;
    this.renderer.sunLight.position.set(
      skyState.sunDirection.x * 200,
      skyState.sunDirection.y * 200,
      skyState.sunDirection.z * 200,
    );
    this.renderer.ambientLight.intensity = 0.15 + skyState.lightIntensity * 0.25;

    // ── Camera mode toggle (F3 = debug fly) ──────────────────────────────
    if (this.input.wasKeyPressed('F3')) {
      this.cameraMode = this.cameraMode === 'player' ? 'fly' : 'player';
    }

    // ── Update active camera controller ──────────────────────────────────
    let camX: number, camZ: number;
    if (this.cameraMode === 'fly') {
      this.flyCamera.update(dt);
      camX = this.renderer.camera.position.x;
      camZ = this.renderer.camera.position.z;
    } else {
      this.playerController.update(dt);
      const pos = this.playerController.getPosition();
      camX = pos.x;
      camZ = pos.z;
    }

    // ── Update held weapon / item viewmodel ───────────────────────────────
    if (this.cameraMode === 'player') {
      this.heldItems.update(
        dt,
        this.playerController.isMoving,
        this.playerController.sprinting
      );
    }

    // ── Update particles, network, interactions, mobs, chunks ─────────────
    this.particles.update(dt);
    this.network.update(dt);
    this.interaction.update(dt);
    this.mobs.update(dt, skyState.lightIntensity < 0.2);
    this.chunkManager.update(camX, camZ, dt);

    // Proximity check to crafting bench
    const pos = this.playerController.getPosition();
    const distSq = (pos.x - 2) * (pos.x - 2) + (pos.z - 2) * (pos.z - 2);
    inventoryState.nearCraftingTable = distSq < 16;

    // Handle hurt timer decay in stats
    if (gameStats.hurtTimer > 0) {
      gameStats.hurtTimer -= dt;
    }

    // ── FPS counter ──────────────────────────────────────────────────────
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      gameStats.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }
  }

  /** Kick off the render loop. */
  public start(): void {
    this.renderer.start((dt) => this.update(dt));
  }
}

// ── Convenience entry point ──────────────────────────────────────────────────

export async function startGame(): Promise<void> {
  const engine = new GameEngine();
  engine.start();
  engine.init().catch((err) => {
    console.warn('[GameEngine] Background asset/network init error:', err);
  });
}
