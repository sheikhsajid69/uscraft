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
const TERMINAL_VELOCITY = 50; // m/s downward
const WALK_SPEED = 4.3; // m/s
const SPRINT_SPEED = 5.6; // m/s
const CROUCH_SPEED_FACTOR = 0.3; // 70 % slower
const CROUCH_LOWER = 0.4; // camera lowers by this amount
const EYE_HEIGHT = 1.6; // eye height above feet
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const PITCH_LIMIT = (89 * Math.PI) / 180; // ±89° in radians

// Third-person spring-arm
const TP_DISTANCE = 4.5; // units behind / in front
const TP_HEIGHT = 2.4; // units above head
const TP_CAMERA_TERRAIN_PAD = 1; // min height above terrain for camera

// Camera transition
const TRANSITION_DURATION = 0.18; // seconds

export type CameraMode = 'first_person' | 'third_person' | 'second_person';

export class PlayerController {
  public position: Vector3;
  public cameraMode: CameraMode = 'first_person';

  // ── Internal state ─────────────────────────────────────────────────
  private velocity: Vector3;
  private yaw: number;
  private pitch: number;
  private grounded: boolean;
  private crouching: boolean;
  public sprinting: boolean = false;
  public isMoving: boolean = false;
  private headBobTimer: number = 0;
  private targetFov: number = 70;

  // Camera transition
  private transitioning: boolean = false;
  private transitionAlpha: number = 1;
  private transitionFrom: Vector3 = new Vector3();
  private transitionTo: Vector3 = new Vector3();
  private previousMode: CameraMode = 'first_person';

  // References
  private camera: PerspectiveCamera;
  private input: InputController;
  private scene: Scene;
  private getTerrainHeight: (x: number, z: number) => number;

  // Player visual capsule
  private capsuleMesh: Mesh;

  // Raycaster for camera collision
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

    // Transition state
    this.transitioning = false;
    this.transitionAlpha = 1;
    this.transitionFrom = new Vector3();
    this.transitionTo = new Vector3();
    this.previousMode = 'first_person';

    // Player capsule (visible in 2nd and 3rd person)
    const capsuleGeom = new CylinderGeometry(PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_HEIGHT, 12);
    const capsuleMat = new MeshLambertMaterial({ color: 0x2288dd });
    this.capsuleMesh = new Mesh(capsuleGeom, capsuleMat);
    this.capsuleMesh.visible = false;
    this.capsuleMesh.castShadow = true;
    this.scene.add(this.capsuleMesh);

    this.raycaster = new Raycaster();
    this.raycaster.far = TP_DISTANCE;
  }

  // ────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────

  update(dt: number): void {
    const clampedDt = Math.min(dt, 0.1);

    this.handleModeToggle();
    this.processMouseLook();
    this.processMovement(clampedDt);
    this.applyPhysics(clampedDt);
    this.terrainCollision();
    this.updateCamera(clampedDt);
    this.updateCapsule();
  }

  getPosition(): Vector3 {
    return this.position.clone();
  }

  getLookVector(out?: Vector3): Vector3 {
    const target = out ?? new Vector3();
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const sinPitch = Math.sin(this.pitch);
    const cosPitch = Math.cos(this.pitch);
    target.set(-sinYaw * cosPitch, sinPitch, -cosYaw * cosPitch).normalize();
    return target;
  }

  getRotation(): [number, number] {
    return [this.yaw, this.pitch];
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

  /** Cycle camera mode on F5 press: 1st -> 3rd (back) -> 2nd (front/selfie) -> 1st. */
  private handleModeToggle(): void {
    if (this.input.wasKeyPressed('F5')) {
      this.previousMode = this.cameraMode;

      if (this.cameraMode === 'first_person') {
        this.cameraMode = 'third_person';
      } else if (this.cameraMode === 'third_person') {
        this.cameraMode = 'second_person';
      } else {
        this.cameraMode = 'first_person';
      }

      this.transitioning = true;
      this.transitionAlpha = 0;
      this.transitionFrom.copy(this.camera.position);
    }
  }

  private processMouseLook(): void {
    const mouseDelta = this.input.getMouseDelta();
    this.yaw -= mouseDelta.x;
    this.pitch -= mouseDelta.y;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  }

  private processMovement(dt: number): void {
    this.crouching = this.input.isKeyDown('ShiftLeft') || this.input.isKeyDown('ShiftRight');
    const wantsSprint = this.input.isKeyDown('ControlLeft') || this.input.isKeyDown('ControlRight');

    const forward = _scratchVec3A.set(0, 0, 0);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    const forwardX = -sinYaw;
    const forwardZ = -cosYaw;
    const rightX = cosYaw;
    const rightZ = -sinYaw;

    if (this.input.isKeyDown('KeyW') || this.input.isKeyDown('ArrowUp')) {
      forward.x += forwardX;
      forward.z += forwardZ;
    }
    if (this.input.isKeyDown('KeyS') || this.input.isKeyDown('ArrowDown')) {
      forward.x -= forwardX;
      forward.z -= forwardZ;
    }
    if (this.input.isKeyDown('KeyA') || this.input.isKeyDown('ArrowLeft')) {
      forward.x -= rightX;
      forward.z -= rightZ;
    }
    if (this.input.isKeyDown('KeyD') || this.input.isKeyDown('ArrowRight')) {
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
      this.targetFov = 66;
    } else {
      this.targetFov = 70;
    }

    if (this.isMoving) {
      forward.normalize().multiplyScalar(speed);
      this.velocity.x = forward.x;
      this.velocity.z = forward.z;
      const bobFreq = this.sprinting ? 14 : 9;
      this.headBobTimer += dt * bobFreq;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
      this.headBobTimer = 0;
    }

    const isSwimming = this.position.y < SEA_LEVEL + 0.5;
    if (this.input.isKeyDown('Space')) {
      if (isSwimming) {
        this.velocity.y = 4.0;
      } else if (this.grounded) {
        this.velocity.y = JUMP_IMPULSE;
        this.grounded = false;
      }
    }
  }

  private applyPhysics(dt: number): void {
    const isSwimming = this.position.y < SEA_LEVEL + 0.5;

    if (isSwimming) {
      this.velocity.y -= GRAVITY * 0.35 * dt;
      this.velocity.y = Math.max(-6, Math.min(6, this.velocity.y));
    } else {
      this.velocity.y -= GRAVITY * dt;
      if (this.velocity.y < -TERMINAL_VELOCITY) {
        this.velocity.y = -TERMINAL_VELOCITY;
      }
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;
  }

  private terrainCollision(): void {
    const terrainHeight = this.getTerrainHeight(this.position.x, this.position.z);
    const minStandingY = terrainHeight + EYE_HEIGHT;

    if (this.position.y <= minStandingY) {
      this.position.y = minStandingY;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
  }

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

  private computeThirdPersonCameraPos(out: Vector3): Vector3 {
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const sinPitch = Math.sin(this.pitch);
    const cosPitch = Math.cos(this.pitch);

    const offsetX = sinYaw * cosPitch * TP_DISTANCE;
    const offsetY = TP_HEIGHT + sinPitch * TP_DISTANCE;
    const offsetZ = cosYaw * cosPitch * TP_DISTANCE;

    out.set(
      this.position.x + offsetX,
      this.position.y + offsetY,
      this.position.z + offsetZ,
    );

    const terrainAtCamera = this.getTerrainHeight(out.x, out.z);
    const minCameraY = terrainAtCamera + TP_CAMERA_TERRAIN_PAD;
    if (out.y < minCameraY) {
      out.y = minCameraY;
    }

    return out;
  }

  /** Compute second-person (front-facing / selfie) camera position. */
  private computeSecondPersonCameraPos(out: Vector3): Vector3 {
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const sinPitch = Math.sin(this.pitch);
    const cosPitch = Math.cos(this.pitch);

    const offsetX = -sinYaw * cosPitch * (TP_DISTANCE * 0.8);
    const offsetY = TP_HEIGHT * 0.6 - sinPitch * (TP_DISTANCE * 0.8);
    const offsetZ = -cosYaw * cosPitch * (TP_DISTANCE * 0.8);

    out.set(
      this.position.x + offsetX,
      this.position.y + offsetY,
      this.position.z + offsetZ,
    );

    const terrainAtCamera = this.getTerrainHeight(out.x, out.z);
    const minCameraY = terrainAtCamera + TP_CAMERA_TERRAIN_PAD;
    if (out.y < minCameraY) {
      out.y = minCameraY;
    }

    return out;
  }

  private updateCamera(dt: number): void {
    if (Math.abs(this.camera.fov - this.targetFov) > 0.05) {
      this.camera.fov += (this.targetFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    const fpTarget = _scratchVec3B;
    const tpTarget = _scratchVec3C;
    const spTarget = _scratchVec3A;

    this.computeFirstPersonCameraPos(fpTarget);
    this.computeThirdPersonCameraPos(tpTarget);
    this.computeSecondPersonCameraPos(spTarget);

    let activeTarget = fpTarget;
    if (this.cameraMode === 'third_person') activeTarget = tpTarget;
    else if (this.cameraMode === 'second_person') activeTarget = spTarget;

    if (this.transitioning) {
      this.transitionAlpha += dt / TRANSITION_DURATION;

      if (this.transitionAlpha >= 1) {
        this.transitionAlpha = 1;
        this.transitioning = false;
      }

      const t = this.smoothStep(this.transitionAlpha);
      this.camera.position.lerpVectors(this.transitionFrom, activeTarget, t);
    } else {
      this.camera.position.copy(activeTarget);
    }

    if (this.cameraMode === 'first_person' && !this.transitioning) {
      _scratchEuler.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(_scratchEuler);
    } else if (this.cameraMode === 'second_person') {
      // In second person, look directly at player eye level
      this.camera.lookAt(this.position.x, this.position.y - 0.2, this.position.z);
    } else {
      // Third person: look at player position
      this.camera.lookAt(this.position);
    }
  }

  private updateCapsule(): void {
    const isVisible = this.cameraMode === 'third_person' || this.cameraMode === 'second_person';
    this.capsuleMesh.visible = isVisible;

    if (isVisible) {
      this.capsuleMesh.position.set(
        this.position.x,
        this.position.y - EYE_HEIGHT + PLAYER_HEIGHT / 2,
        this.position.z,
      );
      this.capsuleMesh.rotation.set(0, this.yaw, 0);
    }
  }

  private smoothStep(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
