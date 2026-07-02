import { PerspectiveCamera, Quaternion, Euler, Vector3 } from 'three';
import type { InputController } from './InputController';

const DEG2RAD = Math.PI / 180;
const MAX_PITCH = 89 * DEG2RAD;

const SPEED_NORMAL = 20;
const SPEED_SPRINT = 60;

/**
 * A free-look fly camera driven by WASD + mouse.
 * Yaw/pitch Euler angles are maintained independently and applied as a
 * quaternion each frame for gimbal-lock-free rotation.
 */
export class FlyCamera {
  private yaw = 0;
  private pitch = 0;

  private readonly camera: PerspectiveCamera;
  private readonly input: InputController;

  // Reusable scratch objects to avoid per-frame allocations
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly quat = new Quaternion();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly movement = new Vector3();

  constructor(camera: PerspectiveCamera, input: InputController) {
    this.camera = camera;
    this.input = input;

    // Starting position: above terrain
    this.camera.position.set(0, 80, 0);
  }

  /** Call every frame with delta time in seconds. */
  public update(dt: number): void {
    // ── Mouse look ───────────────────────────────────────────────────────
    const { dx, dy } = this.input.consumeMouseDelta();
    const sensitivity = 0.002;

    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));

    // Apply rotation
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.quat.setFromEuler(this.euler);
    this.camera.quaternion.copy(this.quat);

    // ── Movement ─────────────────────────────────────────────────────────
    const speed = this.input.isSprint() ? SPEED_SPRINT : SPEED_NORMAL;

    // Extract forward vector (negative Z in camera space)
    this.forward.set(0, 0, -1).applyQuaternion(this.quat);
    this.forward.y = 0;
    this.forward.normalize();

    // Right vector
    this.right.set(1, 0, 0).applyQuaternion(this.quat);
    this.right.y = 0;
    this.right.normalize();

    this.movement.set(0, 0, 0);

    if (this.input.isForward()) this.movement.add(this.forward);
    if (this.input.isBackward()) this.movement.sub(this.forward);
    if (this.input.isRight()) this.movement.add(this.right);
    if (this.input.isLeft()) this.movement.sub(this.right);

    // Vertical movement
    if (this.input.isUp()) this.movement.y += 1;
    if (this.input.isDown()) this.movement.y -= 1;

    if (this.movement.lengthSq() > 0) {
      this.movement.normalize();
      this.camera.position.addScaledVector(this.movement, speed * dt);
    }
  }
}
