import { TICK_RATE } from '../shared/constants.ts';

export class GameLoop {
  private readonly updateFn: (dt: number) => void;
  private readonly renderFn: () => void;

  private animFrameId: number = 0;
  private running: boolean = false;

  private lastTime: number = 0;
  private accumulator: number = 0;

  /** Smoothed frames-per-second value, updated once per second. */
  public fps: number = 0;
  private frameCount: number = 0;
  private fpsAccumulator: number = 0;

  constructor(updateFn: (dt: number) => void, renderFn: () => void) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
  }

  /** Start the game loop. */
  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.frameCount = 0;
    this.fpsAccumulator = 0;
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  /** Stop the game loop. */
  public stop(): void {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  // ---- Private ----

  private tick = (now: number): void => {
    if (!this.running) return;

    const rawDt = (now - this.lastTime) / 1000; // seconds
    this.lastTime = now;

    // Cap delta to prevent spiral-of-death when tab is backgrounded
    const dt = Math.min(rawDt, 0.1);

    // ---- FPS tracking ----
    this.frameCount++;
    this.fpsAccumulator += dt;
    if (this.fpsAccumulator >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsAccumulator -= 1.0;
    }

    // ---- Fixed-timestep physics updates ----
    this.accumulator += dt;
    while (this.accumulator >= TICK_RATE) {
      this.updateFn(TICK_RATE);
      this.accumulator -= TICK_RATE;
    }

    // ---- Render ----
    this.renderFn();

    this.animFrameId = requestAnimationFrame(this.tick);
  };
}
