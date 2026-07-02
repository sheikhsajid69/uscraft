/**
 * Tracks keyboard state and mouse pointer-lock deltas for game input.
 * Supports both continuous key state (`isKeyDown`) and one-shot
 * press detection (`wasKeyPressed`) for toggle keys like F5.
 */
export class InputController {
  private readonly keys = new Map<string, boolean>();
  private readonly justPressed = new Set<string>();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private readonly canvas: HTMLCanvasElement | null;

  constructor() {
    this.canvas = document.querySelector('canvas');

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('click', this.onCanvasClick);

    if (this.canvas) {
      this.canvas.addEventListener('click', this.onCanvasClick);
    }
  }

  // ── Key queries ────────────────────────────────────────────────────────

  public isKeyDown(key: string): boolean {
    return this.keys.get(key) === true;
  }

  /**
   * Returns true only once per key press (not while held).
   * Must be called every frame — it clears the flag after returning true.
   */
  public wasKeyPressed(key: string): boolean {
    if (this.justPressed.has(key)) {
      this.justPressed.delete(key);
      return true;
    }
    return false;
  }

  public isForward(): boolean {
    return this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp');
  }

  public isBackward(): boolean {
    return this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown');
  }

  public isLeft(): boolean {
    return this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft');
  }

  public isRight(): boolean {
    return this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight');
  }

  public isUp(): boolean {
    return this.isKeyDown('Space');
  }

  public isDown(): boolean {
    return this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight');
  }

  public isSprint(): boolean {
    return this.isKeyDown('ControlLeft') || this.isKeyDown('ControlRight');
  }

  public isPointerLocked(): boolean {
    return document.pointerLockElement !== null;
  }

  // ── Mouse delta ────────────────────────────────────────────────────────

  /**
   * Returns accumulated mouse movement since the last call, then resets
   * the accumulator.
   */
  public consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  public getMouseDelta(): { x: number; y: number } {
    const { dx, dy } = this.consumeMouseDelta();
    return { x: dx, y: dy };
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);

    if (this.canvas) {
      this.canvas.removeEventListener('click', this.onCanvasClick);
    }
  }

  // ── Private handlers ───────────────────────────────────────────────────

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.keys.get(e.code)) {
      // Only fire justPressed on the initial keydown, not repeats
      this.justPressed.add(e.code);
    }
    this.keys.set(e.code, true);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.set(e.code, false);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    // Only accumulate when pointer is locked
    if (document.pointerLockElement) {
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    }
  };

  private readonly onCanvasClick = (e?: MouseEvent): void => {
    const target = e?.target as HTMLElement;
    if (target && (target.closest('.inventory-modal') || target.closest('.hotbar') || target.closest('button') || target.closest('input'))) return;
    const canvas = document.querySelector('canvas') || this.canvas;
    if (!document.pointerLockElement && canvas) {
      canvas.requestPointerLock();
    }
  };
}
