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
} from 'three';

/**
 * Core renderer that owns the WebGL context, camera, scene, and lighting.
 * Drives the game loop via requestAnimationFrame with hardware antialiasing
 * and dynamic daylight/fog background.
 */
export class GameRenderer {
  public readonly renderer: WebGLRenderer;
  public readonly camera: PerspectiveCamera;
  public readonly scene: Scene;
  public readonly sunLight: DirectionalLight;
  public readonly ambientLight: AmbientLight;

  private readonly clock: Clock;
  private readonly fogColor = new Color(0x87ceeb);

  constructor() {
    // ── WebGL renderer ─────────────────────────────────────────────────────
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
    this.scene.fog = new Fog(this.fogColor, 120, 500);
    this.scene.background = this.fogColor.clone();

    // ── Lighting ───────────────────────────────────────────────────────────
    // Sun light with shadows
    this.sunLight = new DirectionalLight(0xfff8ee, 1.4);
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
    this.ambientLight = new AmbientLight(0xddeeff, 0.45);
    this.scene.add(this.ambientLight);

    // ── Clock ──────────────────────────────────────────────────────────────
    this.clock = new Clock();

    // ── Resize handling ────────────────────────────────────────────────────
    window.addEventListener('resize', this.onResize);
  }

  /** Update the fog and background colors to match the sky system. */
  public updateFogColor(color: Color): void {
    this.fogColor.copy(color);
    if (this.scene.fog instanceof Fog) {
      this.scene.fog.color.copy(color);
    }
    if (this.scene.background instanceof Color) {
      this.scene.background.copy(color);
    }
  }

  /** Render one frame directly with WebGL hardware antialiasing. */
  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Start the game loop. Calls `updateFn` with the delta time each frame
   * then renders the scene.
   */
  public start(updateFn: (dt: number) => void): void {
    const loop = (): void => {
      requestAnimationFrame(loop);

      const dt = this.clock.getDelta();
      const clampedDt = Math.min(dt, 0.1);

      updateFn(clampedDt);
      this.render();
    };

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
  };
}
