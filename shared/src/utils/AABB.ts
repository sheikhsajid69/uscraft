/**
 * Axis-Aligned Bounding Box used for collision detection and spatial queries.
 *
 * All coordinates use the game's world-space convention where Y is up.
 */
export class AABB {
  constructor(
    public readonly minX: number,
    public readonly minY: number,
    public readonly minZ: number,
    public readonly maxX: number,
    public readonly maxY: number,
    public readonly maxZ: number,
  ) {}

  // ── Getters ─────────────────────────────────────────────────────────────

  /** Extent along the X axis. */
  get width(): number {
    return this.maxX - this.minX;
  }

  /** Extent along the Y axis. */
  get height(): number {
    return this.maxY - this.minY;
  }

  /** Extent along the Z axis. */
  get depth(): number {
    return this.maxZ - this.minZ;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /**
   * Returns `true` when this AABB overlaps `other` on all three axes.
   * Touching edges (equal min/max) are **not** considered an intersection.
   */
  intersects(other: AABB): boolean {
    return (
      this.minX < other.maxX &&
      this.maxX > other.minX &&
      this.minY < other.maxY &&
      this.maxY > other.minY &&
      this.minZ < other.maxZ &&
      this.maxZ > other.minZ
    );
  }

  /**
   * Returns `true` when the point `(x, y, z)` lies inside or exactly on the
   * surface of this AABB.
   */
  containsPoint(x: number, y: number, z: number): boolean {
    return (
      x >= this.minX &&
      x <= this.maxX &&
      y >= this.minY &&
      y <= this.maxY &&
      z >= this.minZ &&
      z <= this.maxZ
    );
  }

  // ── Factories / transforms ──────────────────────────────────────────────

  /**
   * Returns a **new** AABB grown (or shrunk, if values are negative) by the
   * given deltas on each axis.  Positive `dx` expands both `minX` and `maxX`
   * outward by that amount; the total size increase is `2 * dx`.
   */
  expand(dx: number, dy: number, dz: number): AABB {
    return new AABB(
      this.minX - dx,
      this.minY - dy,
      this.minZ - dz,
      this.maxX + dx,
      this.maxY + dy,
      this.maxZ + dz,
    );
  }

  /** Returns a deep copy of this AABB. */
  clone(): AABB {
    return new AABB(
      this.minX,
      this.minY,
      this.minZ,
      this.maxX,
      this.maxY,
      this.maxZ,
    );
  }

  /**
   * Creates an AABB centred at `(cx, cy, cz)` with the given full extents.
   *
   * @param cx - Centre X
   * @param cy - Centre Y
   * @param cz - Centre Z
   * @param w  - Full width  (X extent)
   * @param h  - Full height (Y extent)
   * @param d  - Full depth  (Z extent)
   */
  static fromCenterSize(
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
  ): AABB {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    return new AABB(cx - hw, cy - hh, cz - hd, cx + hw, cy + hh, cz + hd);
  }
}
