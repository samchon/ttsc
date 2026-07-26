export interface IPlaygroundCompilerGeneration {
  /** Whether this token still owns the active compiler Worker generation. */
  isCurrent(): boolean;
}

/**
 * Serializes dependency mutations and fences every asynchronous consumer of a
 * compiler Worker generation.
 *
 * Invalidating a generation immediately makes its active task advisory-only and
 * prevents its queued tasks from starting. New-generation tasks remain
 * serialized behind an active old task so two dependency installers can never
 * mutate the shared compiler filesystem concurrently.
 */
export class PlaygroundCompilerLifecycle {
  private epoch: number = 0;
  private queue: Promise<void> = Promise.resolve();

  public capture(): IPlaygroundCompilerGeneration {
    const epoch = this.epoch;
    return {
      isCurrent: () => this.epoch === epoch,
    };
  }

  public invalidate(): IPlaygroundCompilerGeneration {
    this.epoch++;
    return this.capture();
  }

  public invalidateIfCurrent(
    generation: IPlaygroundCompilerGeneration,
  ): IPlaygroundCompilerGeneration | undefined {
    if (!generation.isCurrent()) return undefined;
    return this.invalidate();
  }

  /**
   * Reset a Worker owned by `generation`, then clear its dependency metadata.
   *
   * The clear deliberately happens before a caller checks any independent
   * source version. A source edit during reset still leaves an empty Worker, so
   * its metadata must become empty too. A Worker-generation replacement
   * performs its own synchronous clear and prevents this stale reset from
   * clearing the replacement.
   */
  public async resetWorkerIfCurrent(
    generation: IPlaygroundCompilerGeneration,
    reset: () => Promise<void>,
    clear: () => void,
  ): Promise<boolean> {
    if (!generation.isCurrent()) return false;
    await reset();
    if (!generation.isCurrent()) return false;
    clear();
    return true;
  }

  public enqueue<T>(
    task: (generation: IPlaygroundCompilerGeneration) => Promise<T>,
  ): Promise<T | undefined> {
    const generation = this.capture();
    const result = this.queue.then(async () => {
      if (!generation.isCurrent()) return undefined;
      return task(generation);
    });
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
