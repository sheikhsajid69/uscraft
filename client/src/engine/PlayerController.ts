import {
  PerspectiveCamera,
  Vector3,
  Euler,
  Quaternion,
  Raycaster,
  Scene,
  Mesh,
  CylinderGeometry,
  MeshLambertMaterial,
  Object3D,
} from 'three';
import type { InputController } from './InputController';
import { SEA_LEVEL } from '@voxelia/shared';

// ── Reusable scratch objects (zero per-frame allocations) ──────────────
const _scratchVec3A = new Vector3();
const _scratchVec3B = new Vector3();
const _scratchVec3C = new Vector3();
const _scratchEuler = new Euler();
const _scratchQuat = new Quaternion();

// ── Constants ──────────────────────────────────────────────────────────
const GRAVITY = 20; // m/s²
const JUMP_IMPULSE = 8; // m/s upward
const TERMINAL_VELOCITY = 50; // m/s downward (positive value, applied as negative)
const WALK_SPEED = 4.3; // m/s
const SPRINT_SPEED = 5.6; // m/s
const CROUCH_SPEED_FACTOR = 0.3; // 70 % slower
const CROUCH_LOWER = 0.4; // camera lowers by this amount
const EYE_HEIGHT = 1.6; // eye height above feet
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const PITCH_LIMIT = (89 * Math.PI) / 180; // ±89° in radians

// Third-person spring-arm
const TP_DISTANCE = 5; // units behind
const TP_HEIGHT = 3; // units above head
const TP_CAMERA_TERRAIN_PAD = 1; // min height above terrain for camera

// Camera transition
const TRANSITION_DURATION = 0.2; // seconds

type CameraMode = 'first_person' | 'third_person';

export class PlayerController {
  public position: Vector3;
  public cameraMode: CameraMode;

  // ── Internal state ─────────────────────────────────────────────────
  private velocity: Vector3;
  private yaw: number;
  private pitch: number;
  private grounded: boolean;
  private crouching: boolean;
  private sprinting: boolean = false;
  private isMoving: boolean = false;
  private headBobTimer: number = 0;
  private targetFov: number = 70;

  // Camera transition
  private transitioning: boolean;
  private transitionAlpha: number;
  private transitionFrom: Vector3;
  private transitionTo: Vector3;
  private previousMode: CameraMode;

  // References
  private camera: PerspectiveCamera;
  private input: InputController;
  private scene: Scene;
  private getTerrainHeight: (x: number, z: number) => number;

  // Player visual capsule
  private capsuleMesh: Mesh;

  // Raycaster for third-person camera collision
  private raycaster: Raycaster;

  constructor(
    camera: PerspectiveCamera,
    input: InputController,
    scene: Scene,
    getTerrainHeight: (x: number, z: number) => number,
  ) {
    this.camera = camera;
    this.input = input;
    this.scene = scene;
    this.getTerrainHeight = getTerrainHeight;
    this.targetFov = camera.fov || 70;

    // Initial state
    this.position = new Vector3(0, 80, 0);
    this.velocity = new Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = false;
    this.crouching = false;
    this.sprinting = false;
    this.isMoving = false;
    this.headBobTimer = 0;
    this.cameraMode = 'first_person';
    this.previousMode = 'first_person';

    // Transition state
    this.transitioning = false;
    this.transitionAlpha = 0;
    this.transitionFrom = new Vector3();
    this.transitionTo = new Vector3();

    // Raycaster
    this.raycaster = new Raycaster();

    // Player capsule mesh – visible only in third-person
    const capsuleGeo = new CylinderGeometry(PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_HEIGHT, 8);
    const capsuleMat = new MeshLambertMaterial({ color: 0x3399ff });
    this.capsuleMesh = new Mesh(capsuleGeo, capsuleMat);
    this.capsuleMesh.visible = false;
    this.scene.add(this.capsuleMesh);
  }

  // ────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────

  /**
   * Main per-frame update. Call once per animation frame.
   * @param dt – delta time in seconds
   */
  update(dt: number): void {
    // Clamp dt to avoid spiral-of-death on tab-away
    const clampedDt = Math.min(dt, 0.1);

    this.handleModeToggle();
    this.processMouseLook();
    this.processMovement(clampedDt);
    this.applyPhysics(clampedDt);
    this.terrainCollision();
    this.updateCamera(clampedDt);
    this.updateCapsule();
  }

  /** Returns a copy of the current player position (eye-level). */
  getPosition(): Vector3 {
    return this.position.clone();
  }

  /** Returns the current look direction vector. */
  getLookVector(out?: Vector3): Vector3 {
    const target = out ?? new Vector3();
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const sinPitch = Math.sin(this.pitch);
    const cosPitch = Math.cos(this.pitch);
    target.set(-sinYaw * cosPitch, sinPitch, -cosYaw * cosPitch).normalize();
    return target;
  }

  /** Returns current yaw and pitch in radians. */
  getRotation(): [number, number] {
    return [this.yaw, this.pitch];
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

  /** Toggle camera mode on F5 press. */
  private handleModeToggle(): void {
    if (this.input.wasKeyPressed('F5')) {
      this.previousMode = this.cameraMode;
      this.cameraMode = this.cameraMode === 'first_person' ? 'third_person' : 'first_person';

      // Kick off transition
      this.transitioning = true;
      this.transitionAlpha = 0;
      this.transitionFrom.copy(this.camera.position);

      // Pre-calculate where the camera will end up
      if (this.cameraMode === 'first_person') {
        this.computeFirstPersonCameraPos(this.transitionTo);
      } else {
        this.computeThirdPersonCameraPos(this.transitionTo);
      }
    }
  }

  /** Apply mouse look deltas to yaw / pitch. */
  private processMouseLook(): void {
    const mouseDelta = this.input.getMouseDelta();
    this.yaw -= mouseDelta.x;
    this.pitch -= mouseDelta.y;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  }

  /** Process WASD movement and jump / crouch inputs. */
  private processMovement(dt: number): void {
    // Determine speed
    this.crouching = this.input.isKeyDown('ShiftLeft') || this.input.isKeyDown('ShiftRight');
    const wantsSprint = this.input.isKeyDown('ControlLeft') || this.input.isKeyDown('ControlRight');

    // Build movement vector in XZ plane relative to yaw
    const forward = _scratchVec3A.set(0, 0, 0);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    // Forward direction (negative Z in camera space → world)
    const forwardX = -sinYaw;
    const forwardZ = -cosYaw;
    // Right direction
    const rightX = cosYaw;
    const rightZ = -sinYaw;

    if (this.input.isKeyDown('KeyW')) {
      forward.x += forwardX;
      forward.z += forwardZ;
    }
    if (this.input.isKeyDown('KeyS')) {
      forward.x -= forwardX;
      forward.z -= forwardZ;
    }
    if (this.input.isKeyDown('KeyA')) {
      forward.x -= rightX;
      forward.z -= rightZ;
    }
    if (this.input.isKeyDown('KeyD')) {
      forward.x += rightX;
      forward.z += rightZ;
    }

    this.isMoving = forward.lengthSq() > 0;
    this.sprinting = wantsSprint && this.isMoving && !this.crouching;

    let speed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (this.crouching) {
      speed *= CROUCH_SPEED_FACTOR;
    }

    if (this.sprinting) {
      this.targetFov = 78;
    } else if (this.crouching) {
      this.targetFov = 64;
    } else {
      this.targetFov = 70;
    }

    if (this.grounded && this.isMoving) {
      this.headBobTimer += dt * (this.sprinting ? 14 : 10);
    } else if (!this.isMoving) {
      this.headBobTimer *= Math.pow(0.1, dt);
    }

    // Normalize to prevent diagonal speed boost, then scale
    if (this.isMoving) {
      forward.normalize().multiplyScalar(speed * dt);
      this.position.x += forward.x;
      this.position.z += forward.z;
    }

    // Jump
    if (
      (this.input.isKeyDown('Space') || this.input.wasKeyPressed('Space')) &&
      this.grounded
    ) {
      this.velocity.y = JUMP_IMPULSE;
      this.grounded = false;
    }
  }

  /** Apply gravity to vertical velocity and integrate. */
  private applyPhysics(dt: number): void {
    const inWater = this.position.y - EYE_HEIGHT < SEA_LEVEL;
    if (inWater) {
      // Buoyancy and water resistance
      this.velocity.y -= (GRAVITY * 0.25) * dt;
      this.velocity.y *= Math.pow(0.5, dt); // viscous damping
      if (this.input.isKeyDown('Space') || this.input.wasKeyPressed('Space')) {
        this.velocity.y = JUMP_IMPULSE * 0.45; // swim upward
      }
    } else {
      // Normal air gravity
      this.velocity.y -= GRAVITY * dt;
    }

    // Clamp at terminal velocity
    if (this.velocity.y < -TERMINAL_VELOCITY) {
      this.velocity.y = -TERMINAL_VELOCITY;
    }

    // Integrate vertical position
    this.position.y += this.velocity.y * dt;
  }

  /** Snap player to terrain surface if below it. */
  private terrainCollision(): void {
    const terrainY = this.getTerrainHeight(this.position.x, this.position.z);
    const feetTarget = terrainY + EYE_HEIGHT;

    if (this.position.y <= feetTarget) {
      this.position.y = feetTarget;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
  }

  // ── Camera helpers ─────────────────────────────────────────────────

  /** Compute the first-person camera target position. */
  private computeFirstPersonCameraPos(out: Vector3): Vector3 {
    out.copy(this.position);
    if (this.crouching) {
      out.y -= CROUCH_LOWER;
    }
    if (this.grounded && this.isMoving && !this.transitioning) {
      const bobAmpY = this.sprinting ? 0.08 : 0.05;
      const bobAmpX = this.sprinting ? 0.05 : 0.03;
      out.y += Math.sin(this.headBobTimer * 2) * bobAmpY;
      const cosYaw = Math.cos(this.yaw);
      const sinYaw = Math.sin(this.yaw);
      const sideBob = Math.cos(this.headBobTimer) * bobAmpX;
      out.x += cosYaw * sideBob;
      out.z -= sinYaw * sideBob;
    }
    return out;
  }

  /** Compute the third-person camera target position (with terrain clamp). */
  private computeThirdPersonCameraPos(out: Vector3): Vector3 {
    // Direction the camera should look from (behind & above)
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const sinPitch = Math.sin(this.pitch);
    const cosPitch = Math.cos(this.pitch);

    // Camera offset in world space: behind the player along the view direction
    const offsetX = sinYaw * cosPitch * TP_DISTANCE;
    const offsetY = TP_HEIGHT + sinPitch * TP_DISTANCE;
    const offsetZ = cosYaw * cosPitch * TP_DISTANCE;

    out.set(
      this.position.x + offsetX,
      this.position.y + offsetY,
      this.position.z + offsetZ,
    );

    // Prevent camera from going below terrain
    const terrainAtCamera = this.getTerrainHeight(out.x, out.z);
    const minCameraY = terrainAtCamera + TP_CAMERA_TERRAIN_PAD;
    if (out.y < minCameraY) {
      out.y = minCameraY;
    }

    return out;
  }

  /** Update camera position, rotation, and handle mode transitions. */
  private updateCamera(dt: number): void {
    // Dynamic FOV lerp during sprint/crouch
    if (Math.abs(this.camera.fov - this.targetFov) > 0.05) {
      this.camera.fov += (this.targetFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    // Compute target positions for each mode
    const fpTarget = _scratchVec3B;
    const tpTarget = _scratchVec3C;
    this.computeFirstPersonCameraPos(fpTarget);
    this.computeThirdPersonCameraPos(tpTarget);

    if (this.transitioning) {
      // Advance transition
      this.transitionAlpha += dt / TRANSITION_DURATION;

      if (this.transitionAlpha >= 1) {
        this.transitionAlpha = 1;
        this.transitioning = false;
      }

      // Smooth-step for nicer feel
      const t = this.smoothStep(this.transitionAlpha);

      // Determine the actual from/to based on target mode
      const fromPos = this.cameraMode === 'first_person' ? tpTarget : fpTarget;
      const toPos = this.cameraMode === 'first_person' ? fpTarget : tpTarget;

      this.camera.position.lerpVectors(fromPos, toPos, t);
    } else {
      // Steady-state
      if (this.cameraMode === 'first_person') {
        this.camera.position.copy(fpTarget);
      } else {
        this.camera.position.copy(tpTarget);
      }
    }

    // Camera rotation — always look towards the player's facing direction
    if (this.cameraMode === 'first_person' && !this.transitioning) {
      // First person: camera rotation matches yaw / pitch directly
      _scratchEuler.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(_scratchEuler);
    } else {
      // Third person (and during transition): look at the player position
      const lookTarget = _scratchVec3A.copy(this.position);
      this.camera.lookAt(lookTarget);
    }
  }

  /** Update the capsule mesh's position and visibility. */
  private updateCapsule(): void {
    const isThirdPerson = this.cameraMode === 'third_person';
    this.capsuleMesh.visible = isThirdPerson;

    if (isThirdPerson) {
      // Position capsule at player body center (feet + half height)
      this.capsuleMesh.position.set(
        this.position.x,
        this.position.y - EYE_HEIGHT + PLAYER_HEIGHT / 2,
        this.position.z,
      );
      // Rotate capsule to face the yaw direction
      this.capsuleMesh.rotation.set(0, this.yaw, 0);
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────

  /** Classic smooth-step interpolation (3t² - 2t³). */
  private smoothStep(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
