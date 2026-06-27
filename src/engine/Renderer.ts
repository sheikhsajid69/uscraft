import * as THREE from 'three';
import { FOG_NEAR, FOG_FAR } from '../shared/constants.ts';

export class Renderer {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;

  private readonly ambientLight: THREE.AmbientLight;
  private readonly directionalLight: THREE.DirectionalLight;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    // ---- WebGL Renderer ----
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ---- Scene ----
    this.scene = new THREE.Scene();
    const skyColor = 0x87ceeb;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.Fog(skyColor, FOG_NEAR, FOG_FAR);

    // ---- Camera ----
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );

    // ---- Ambient Light ----
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // ---- Directional Light (sun) ----
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(50, 100, 50);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 300;
    this.directionalLight.shadow.camera.left = -64;
    this.directionalLight.shadow.camera.right = 64;
    this.directionalLight.shadow.camera.top = 64;
    this.directionalLight.shadow.camera.bottom = -64;
    this.scene.add(this.directionalLight);

    // ---- Resize Handler ----
    window.addEventListener('resize', this.onResize);
  }

  /** Render one frame. */
  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Clean up event listeners. */
  public dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }

  // ---- Private ----

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
  };
}
