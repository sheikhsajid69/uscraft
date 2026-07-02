import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Fog,
  DirectionalLight,
  AmbientLight,
  Clock,
  Color,
  PCFSoftShadowMap,
  Vector2,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Core renderer that owns the WebGL context, camera, scene, and lighting.
 * Drives the game loop via requestAnimationFrame.
 *
 * Supports shadow mapping on directional sun light, dynamic fog/background,
 * and post-processing UnrealBloomPass tuned for emissive light sources.
 */
export class GameRenderer {
  public readonly renderer: WebGLRenderer;
  public readonly camera: PerspectiveCamera;
  public readonly scene: Scene;
  public readonly sunLight: DirectionalLight;
  public readonly ambientLight: AmbientLight;
  public readonly composer: EffectComposer;
  public readonly bloomPass: UnrealBloomPass;

  private readonly clock: Clock;
  private readonly fogColor = new Color(0x87ceeb);

  constructor() {
    // ── WebGL renderer ─────────────────────────────────────────────────────
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Shadow mapping
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.renderer.domElement.style.position = 'fixed';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.width = '100vw';
    this.renderer.domElement.style.height = '100vh';
    this.renderer.domElement.style.zIndex = '1';
    document.body.appendChild(this.renderer.domElement);

    // ── Camera ─────────────────────────────────────────────────────────────
    this.camera = new PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      600,
    );

    // ── Scene ──────────────────────────────────────────────────────────────
    this.scene = new Scene();
    this.scene.fog = new Fog(this.fogColor, 180, 500);
    this.scene.background = this.fogColor.clone();

    // ── Lighting ───────────────────────────────────────────────────────────
    // Sun light with shadows
    this.sunLight = new DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(100, 200, 100);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -120;
    this.sunLight.shadow.camera.right = 120;
    this.sunLight.shadow.camera.top = 120;
    this.sunLight.shadow.camera.bottom = -120;
    this.sunLight.shadow.bias = -0.001;
    this.scene.add(this.sunLight);

    // Soft ambient fill
    this.ambientLight = new AmbientLight(0xb0d0ff, 0.35);
    this.scene.add(this.ambientLight);

    // ── Post-Processing & Bloom ────────────────────────────────────────────
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Threshold high (0.82) so only emissive torches, moon figure, and high-intensity lights bloom
    this.bloomPass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      0.45, // strength
      0.4,  // radius
      0.82, // threshold
    );
    this.composer.addPass(this.bloomPass);

    // ── Clock ──────────────────────────────────────────────────────────────
    this.clock = new Clock();

    // ── Resize handling ────────────────────────────────────────────────────
    window.addEventListener('resize', this.onResize);
  }

  /** Update the fog and background colors to match the sky system. */
  public updateFogColor(color: Color): void {
    this.fogColor.copy(color);
    (this.scene.fog as Fog).color.copy(color);
    (this.scene.background as Color).copy(color);
  }

  /** Render one frame with post-processing composer. */
  public render(): void {
    this.composer.render();
  }

  /**
   * Start the game loop. Calls `updateFn` with the delta time each frame
   * then renders the scene.
   */
  public start(updateFn: (dt: number) => void): void {
    const loop = (): void => {
      requestAnimationFrame(loop);

      const dt = this.clock.getDelta();
      // Clamp dt to avoid spiral-of-death on tab-switch
      const clampedDt = Math.min(dt, 0.1);

      updateFn(clampedDt);
      this.render();
    };

    // Consume any accumulated time before first frame
    this.clock.getDelta();
    requestAnimationFrame(loop);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private readonly onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };
}
