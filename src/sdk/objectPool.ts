/**
 * Generic Zero-GC Object Pool using O(1) in-place swap-and-pop removal.
 * Designed for high-frequency game entities: bullets, particles, enemies, and pickups.
 */
export class ObjectPool<T> {
  private readonly active: T[] = [];
  private readonly free: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (item: T) => void;

  constructor(factory: () => T, reset: (item: T) => void, initialSize: number = 0) {
    this.factory = factory;
    this.reset = reset;

    const count = Math.max(0, Math.floor(initialSize));
    for (let i = 0; i < count; i++) {
      const item = this.factory();
      this.reset(item);
      this.free.push(item);
    }
  }

  /**
   * Acquires an item from the pool, or allocates a new one via `factory` if exhausted.
   */
  public acquire(): T {
    let item: T;
    if (this.free.length > 0) {
      item = this.free.pop()!;
    } else {
      item = this.factory();
      this.reset(item);
    }
    this.active.push(item);
    return item;
  }

  /**
   * Releases the active item at `index` in O(1) using in-place swap-and-pop
   * (zero array allocations, no `.filter()` or `.splice()`).
   */
  public release(index: number): void {
    const lastIndex = this.active.length - 1;
    if (index < 0 || index > lastIndex) return;

    const item = this.active[index];
    if (index !== lastIndex) {
      this.active[index] = this.active[lastIndex];
    }
    this.active.pop();

    this.reset(item);
    this.free.push(item);
  }

  /**
   * Convenience helper to release by object reference.
   */
  public releaseItem(item: T): boolean {
    const index = this.active.indexOf(item);
    if (index === -1) return false;
    this.release(index);
    return true;
  }

  /**
   * Releases all currently active items back into the free pool.
   */
  public releaseAll(): void {
    while (this.active.length > 0) {
      const item = this.active.pop()!;
      this.reset(item);
      this.free.push(item);
    }
  }

  /**
   * Returns a read-only view of currently active pooled items.
   */
  public getActiveItems(): readonly T[] {
    return this.active;
  }

  public get activeCount(): number {
    return this.active.length;
  }

  public get freeCount(): number {
    return this.free.length;
  }

  public get totalAllocated(): number {
    return this.active.length + this.free.length;
  }
}
