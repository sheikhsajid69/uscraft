/**
 * Singleton input manager.
 *
 * Tracks keyboard, mouse-button, pointer-lock, mouse-move delta, and scroll
 * state.  Call `update()` at the END of every frame to clear per-frame data.
 */
export class InputManager {
  // ---- Singleton ----
  private static instance: InputManager | null = null;

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  // ---- Keyboard ----
  /** Keys currently held down (event.code, lowercased). */
  public readonly keysDown: Set<string> = new Set();
  /** Keys pressed THIS frame only. Cleared by `update()`. */
  public readonly keysPressed: Set<string> = new Set();

  // ---- Mouse buttons ----
  /** Mouse buttons currently held. */
  public readonly mouseDown: Set<number> = new Set();
  /** Mouse buttons pressed THIS frame only. Cleared by `update()`. */
  public readonly mousePressed: Set<number> = new Set();

  // ---- Mouse movement ----
  public mouseDX: number = 0;
  public mouseDY: number = 0;

  // ---- Scroll ----
  public scrollDelta: number = 0;

  // ---- Private ----
  private constructor() {
    this.attachListeners();
  }

  // ================================================================
  // Public query helpers
  // ================================================================

  public isKeyDown(code: string): boolean {
    return this.keysDown.has(code.toLowerCase());
  }

  public isKeyPressed(code: string): boolean {
    return this.keysPressed.has(code.toLowerCase());
  }

  public isMouseButtonDown(button: number): boolean {
    return this.mouseDown.has(button);
  }

  public isMouseButtonPressed(button: number): boolean {
    return this.mousePressed.has(button);
  }

  public getMouseDelta(): { x: number; y: number } {
    return { x: this.mouseDX, y: this.mouseDY };
  }

  public getScrollDelta(): number {
    return this.scrollDelta;
  }

  // ================================================================
  // Pointer lock
  // ================================================================

  public lockPointer(element: HTMLElement): void {
    element.requestPointerLock();
  }

  public unlockPointer(): void {
    document.exitPointerLock();
  }

  public isPointerLocked(): boolean {
    return document.pointerLockElement !== null;
  }

  // ================================================================
  // Frame lifecycle – call at END of frame
  // ================================================================

  public update(): void {
    this.keysPressed.clear();
    this.mousePressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.scrollDelta = 0;
  }

  // ================================================================
  // Internal event wiring
  // ================================================================

  private attachListeners(): void {
    // ---- Keyboard ----
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Prevent browser shortcuts that interfere with gameplay
      const blocked = ['f5', 'f7', 'f12'];
      const code = e.code.toLowerCase();

      if (blocked.includes(code)) {
        e.preventDefault();
      }

      if (!this.keysDown.has(code)) {
        this.keysPressed.add(code);
      }
      this.keysDown.add(code);
    });

    document.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysDown.delete(e.code.toLowerCase());
    });

    // ---- Mouse move (only while locked) ----
    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isPointerLocked()) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });

    // ---- Mouse buttons ----
    document.addEventListener('mousedown', (e: MouseEvent) => {
      this.mouseDown.add(e.button);
      this.mousePressed.add(e.button);
    });

    document.addEventListener('mouseup', (e: MouseEvent) => {
      this.mouseDown.delete(e.button);
    });

    // ---- Scroll ----
    document.addEventListener('wheel', (e: WheelEvent) => {
      this.scrollDelta += e.deltaY;
    }, { passive: true });

    // ---- Pointer-lock change (clean up state on unlock) ----
    document.addEventListener('pointerlockchange', () => {
      if (!this.isPointerLocked()) {
        // Clear movement deltas when pointer is unlocked so stale values
        // don't carry over into the next lock session.
        this.mouseDX = 0;
        this.mouseDY = 0;
      }
    });
  }
}
