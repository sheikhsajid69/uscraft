import {
  Scene,
  Color,
  Mesh,
  SphereGeometry,
  ShaderMaterial,
  BackSide,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
  CanvasTexture,
  Vector3,
  AdditiveBlending,
} from 'three';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface SkyState {
  horizonColor: Color;
  lightIntensity: number;
  sunDirection: { x: number; y: number; z: number };
}

// ---------------------------------------------------------------------------
// Shader source
// ---------------------------------------------------------------------------

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;        // 0‒1 day cycle (0 = midnight, 0.5 = noon)
uniform vec3  uTopColor;    // zenith
uniform vec3  uBottomColor; // horizon
uniform vec3  uSunPosition; // world‑space sun direction (normalised)

varying vec3 vWorldPosition;

// ---- pseudo‑random hash used for stars ----
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec3 dir = normalize(vWorldPosition);
  float h  = max(dir.y, 0.0);          // 0 at horizon, 1 at zenith

  // --- base gradient ---
  vec3 color = mix(uBottomColor, uTopColor, h);

  // --- sun glow ---
  vec3 sunDir   = normalize(uSunPosition);
  float sunDot  = max(dot(dir, sunDir), 0.0);
  // Soft halo around the sun
  float sunGlow = pow(sunDot, 256.0) * 1.5;          // bright core
  sunGlow      += pow(sunDot, 8.0)   * 0.35;         // wide halo
  // Only show when sun is above horizon
  float sunAbove = smoothstep(-0.05, 0.1, sunDir.y);
  color += vec3(1.0, 0.9, 0.7) * sunGlow * sunAbove;

  // --- sunset / sunrise horizon blush ---
  // When the sun is near the horizon, add warm tones at the base of the sky
  float sunHorizonFactor = 1.0 - smoothstep(0.0, 0.35, abs(sunDir.y));
  float horizonBand      = 1.0 - smoothstep(0.0, 0.4, h);
  float blushStrength     = sunHorizonFactor * horizonBand * sunAbove;
  vec3  blushColor        = mix(vec3(1.0, 0.498, 0.314), vec3(1.0, 0.714, 0.757), h);
  color = mix(color, blushColor, blushStrength * 0.6);

  // --- stars (night only) ---
  // uTime: 0 = midnight, 0.5 = noon
  // Stars visible roughly 0.0–0.20 and 0.80–1.0
  float nightFactor = 1.0 - smoothstep(0.20, 0.30, uTime)
                     + smoothstep(0.70, 0.80, uTime);
  nightFactor = clamp(nightFactor, 0.0, 1.0);

  if (nightFactor > 0.01 && dir.y > 0.0) {
    // tile the sky into a grid and pick random stars
    vec2 uv   = dir.xz / (dir.y + 0.001);  // project onto a plane
    vec2 cell = floor(uv * 80.0);
    float r   = hash(cell);
    // ~8 % of cells get a star
    float star = step(0.92, r);
    // twinkle
    float twinkle = 0.7 + 0.3 * sin(r * 6283.0 + uTime * 12.566);
    color += vec3(star * twinkle * nightFactor * 0.9);
  }

  // --- moon glow (opposite side of the sun) ---
  vec3  moonDir   = -sunDir;
  float moonDot   = max(dot(dir, moonDir), 0.0);
  float moonGlow  = pow(moonDot, 512.0) * 1.0;
  moonGlow       += pow(moonDot, 16.0) * 0.15;
  float moonAbove = smoothstep(-0.05, 0.1, moonDir.y);
  color += vec3(0.8, 0.85, 1.0) * moonGlow * moonAbove * nightFactor;

  gl_FragColor = vec4(color, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Helper – create a radial‑gradient disc texture
// ---------------------------------------------------------------------------

function createDiscTexture(
  size: number,
  centerColor: string,
  edgeColor: string,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, centerColor);
  gradient.addColorStop(0.5, centerColor);
  gradient.addColorStop(1, edgeColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  return tex;
}

// ---------------------------------------------------------------------------
// Colour presets for different times of day
// ---------------------------------------------------------------------------

const DAY_ZENITH   = new Color(0x1E90FF);
const DAY_HORIZON  = new Color(0x87CEEB);

const NIGHT_ZENITH  = new Color(0x050A30);
const NIGHT_HORIZON = new Color(0x0C1445);

const SUNSET_ZENITH  = new Color(0x1E60CC);
const SUNSET_HORIZON = new Color(0xFF7F50);

const SUNRISE_ZENITH  = new Color(0x2070DD);
const SUNRISE_HORIZON = new Color(0xFFB6C1);

// ---------------------------------------------------------------------------
// SkySystem
// ---------------------------------------------------------------------------

const ORBIT_RADIUS = 400;

export class SkySystem {
  private skyMesh: Mesh;
  private skyMaterial: ShaderMaterial;
  private sunMesh: Mesh;
  private moonMesh: Mesh;

  private sunTexture: CanvasTexture;
  private moonTexture: CanvasTexture;

  private scene: Scene;

  // Reusable temporaries
  private _horizonColor = new Color();
  private _zenithColor = new Color();
  private _sunPos = new Vector3();

  constructor(scene: Scene) {
    this.scene = scene;

    // ---- sky dome ----
    const skyGeo = new SphereGeometry(450, 32, 32);
    this.skyMaterial = new ShaderMaterial({
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      uniforms: {
        uTime:        { value: 0.0 },
        uTopColor:    { value: new Color(DAY_ZENITH) },
        uBottomColor: { value: new Color(DAY_HORIZON) },
        uSunPosition: { value: new Vector3(0, 1, 0) },
      },
      side: BackSide,
      depthWrite: false,
      fog: false,
    });

    this.skyMesh = new Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.renderOrder = -1000;
    this.skyMesh.frustumCulled = false;
    scene.add(this.skyMesh);

    // ---- sun sprite ----
    this.sunTexture = createDiscTexture(128, 'rgba(255,250,200,1)', 'rgba(255,200,50,0)');
    const sunMat = new MeshBasicMaterial({
      map: this.sunTexture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
      blending: AdditiveBlending,
    });
    const sunGeo = new PlaneGeometry(40, 40);
    this.sunMesh = new Mesh(sunGeo, sunMat);
    this.sunMesh.renderOrder = -999;
    this.sunMesh.frustumCulled = false;
    scene.add(this.sunMesh);

    // ---- moon sprite ----
    this.moonTexture = createDiscTexture(128, 'rgba(220,230,255,1)', 'rgba(180,200,255,0)');
    const moonMat = new MeshBasicMaterial({
      map: this.moonTexture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
      blending: AdditiveBlending,
    });
    const moonGeo = new PlaneGeometry(28, 28);
    this.moonMesh = new Mesh(moonGeo, moonMat);
    this.moonMesh.renderOrder = -999;
    this.moonMesh.frustumCulled = false;
    scene.add(this.moonMesh);
  }

  // -----------------------------------------------------------------------
  // update()
  // worldTime: 0‒1  (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
  // -----------------------------------------------------------------------

  update(worldTime: number): SkyState {
    const t = ((worldTime % 1) + 1) % 1; // normalise to [0,1)

    // ---- sun angle (radians) ----
    // At t = 0.25 sun is at the east horizon (angle = 0)
    // At t = 0.50 sun is at zenith             (angle = π/2)
    // At t = 0.75 sun is at the west horizon   (angle = π)
    const sunAngle = (t - 0.25) * Math.PI * 2; // full circle, but we only see half

    // Sun orbit: rises in +X (east), sets in −X (west), up is +Y
    const sx = Math.cos(sunAngle) * ORBIT_RADIUS;
    const sy = Math.sin(sunAngle) * ORBIT_RADIUS;
    const sz = 0;

    this._sunPos.set(sx, sy, sz);
    this.sunMesh.position.copy(this._sunPos);
    this.sunMesh.lookAt(0, 0, 0); // always face the camera origin

    // Moon is on the opposite side
    this.moonMesh.position.set(-sx, -sy, -sz);
    this.moonMesh.lookAt(0, 0, 0);

    // ---- compute sky colours ----
    // Blend zones:
    //   midnight       → pre‑sunrise   [0.00 – 0.20]  night
    //   sunrise         → morning       [0.20 – 0.30]  sunrise transition
    //   morning         → pre‑sunset    [0.30 – 0.70]  day
    //   pre‑sunset      → sunset        [0.70 – 0.80]  sunset transition
    //   sunset          → midnight      [0.80 – 1.00]  night

    const zenith  = this._zenithColor;
    const horizon = this._horizonColor;

    if (t < 0.20) {
      // Night
      zenith.copy(NIGHT_ZENITH);
      horizon.copy(NIGHT_HORIZON);
    } else if (t < 0.30) {
      // Sunrise transition
      const f = (t - 0.20) / 0.10;
      zenith.copy(NIGHT_ZENITH).lerp(SUNRISE_ZENITH, f).lerp(DAY_ZENITH, f);
      horizon.copy(NIGHT_HORIZON).lerp(SUNRISE_HORIZON, f);
    } else if (t < 0.40) {
      // Sunrise → full day
      const f = (t - 0.30) / 0.10;
      zenith.copy(SUNRISE_ZENITH).lerp(DAY_ZENITH, f);
      horizon.copy(SUNRISE_HORIZON).lerp(DAY_HORIZON, f);
    } else if (t < 0.60) {
      // Full day
      zenith.copy(DAY_ZENITH);
      horizon.copy(DAY_HORIZON);
    } else if (t < 0.70) {
      // Day → sunset start
      const f = (t - 0.60) / 0.10;
      zenith.copy(DAY_ZENITH).lerp(SUNSET_ZENITH, f);
      horizon.copy(DAY_HORIZON).lerp(SUNSET_HORIZON, f);
    } else if (t < 0.80) {
      // Sunset transition
      const f = (t - 0.70) / 0.10;
      zenith.copy(SUNSET_ZENITH).lerp(NIGHT_ZENITH, f);
      horizon.copy(SUNSET_HORIZON).lerp(NIGHT_HORIZON, f);
    } else {
      // Night
      zenith.copy(NIGHT_ZENITH);
      horizon.copy(NIGHT_HORIZON);
    }

    // ---- push uniforms ----
    const u = this.skyMaterial.uniforms;
    u.uTime.value = t;
    u.uTopColor.value.copy(zenith);
    u.uBottomColor.value.copy(horizon);

    const sunDir = this._sunPos.clone().normalize();
    u.uSunPosition.value.copy(sunDir);

    // ---- follow camera (keep dome centred on the player) ----
    // The sky dome is placed at origin; in the render loop the caller
    // should set skyMesh.position to the camera position if desired.
    // Here we keep it at (0,0,0) which works for large radius.

    // ---- compute light intensity ----
    // Peaks at noon (t = 0.5), minimum at midnight (t = 0)
    const sinAlt = Math.sin(sunAngle); // sun altitude sine
    const lightIntensity = Math.max(0.1, Math.min(1.0,
      sinAlt * 0.9 + 0.1,
    ));

    return {
      horizonColor: horizon.clone(),
      lightIntensity,
      sunDirection: { x: sunDir.x, y: sunDir.y, z: sunDir.z },
    };
  }

  // -----------------------------------------------------------------------
  // dispose – clean up GPU resources
  // -----------------------------------------------------------------------

  dispose(): void {
    this.scene.remove(this.skyMesh);
    this.scene.remove(this.sunMesh);
    this.scene.remove(this.moonMesh);

    this.skyMesh.geometry.dispose();
    this.skyMaterial.dispose();

    this.sunMesh.geometry.dispose();
    (this.sunMesh.material as MeshBasicMaterial).dispose();
    this.sunTexture.dispose();

    this.moonMesh.geometry.dispose();
    (this.moonMesh.material as MeshBasicMaterial).dispose();
    this.moonTexture.dispose();
  }
}
