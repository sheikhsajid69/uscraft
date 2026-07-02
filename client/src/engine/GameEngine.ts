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

  // Camera mode: 'player' (default) or 'fly' (debug, toggled with F3)
  private cameraMode: 'player' | 'fly' = 'player';

  // Day/night cycle: 0–1 over 600 seconds (10 min real time = 1 game day)
  private worldTime = 0.3; // Start at early morning
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
    this.interaction = new BlockInteraction(
      this.renderer.scene,
      this.chunkManager,
      this.playerController,
      this.input,
      audio,
      this.particles,
      this.network,
    );
    this.mobs = new MobSystem(this.renderer.scene, this.chunkManager, this.playerController);
  }

  /**
   * Async initialisation: loads the anchor terrain GLB, computes its
   * bounding box, conforms voxel terrain to it, and places it in the scene.
   */
  public async init(): Promise<void> {
    try {
      const result = await this.assetLoader.loadAnchorTerrain();
      const { model, bbox, baseY } = result;

      // Set anchor bounds so ChunkManager conforms terrain to the GLB base
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
      // Anchor model is optional in dev — log and continue
      console.warn('[GameEngine] Failed to load anchor terrain:', err);
    }

    try {
      this.network.connect('http://localhost:3001');
    } catch (err) {
      console.warn('[GameEngine] Failed to connect to multiplayer server:', err);
    }

    try {
      const benchModel = await this.assetLoader.loadModel('/assets/models/bench_minecraft.glb');
      benchModel.position.set(2, queryTerrainHeight(2, 2), 2);
      benchModel.scale.setScalar(1.0);
      this.renderer.scene.add(benchModel);
    } catch (err) {
      console.warn('[GameEngine] Failed to load crafting bench model:', err);
    }
  }

  /**
   * Per-frame update: sky, camera, then stream chunks.
   */
  public update(dt: number): void {
    // ── Day/night cycle ──────────────────────────────────────────────────
    this.worldTime += dt / GameEngine.DAY_DURATION;
    if (this.worldTime >= 1) this.worldTime -= 1;

    const skyState = this.sky.update(this.worldTime);

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
      console.log(`[GameEngine] Camera mode: ${this.cameraMode}`);
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

    // ── Update particles, network, interactions, mobs, chunks ─────────────
    this.particles.update(dt);
    this.network.update(dt);
    this.interaction.update(dt);
    this.mobs.update(dt, skyState.lightIntensity < 0.2);
    this.chunkManager.update(camX, camZ, dt);

    // Check proximity to crafting bench (wx=2, wz=2)
    const pos = this.playerController.getPosition();
    const distSq = (pos.x - 2) * (pos.x - 2) + (pos.z - 2) * (pos.z - 2);
    inventoryState.nearCraftingTable = distSq < 16;

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

