import fs from "node:fs";
import path from "node:path";

import { retireLockDirectory } from "../../../internal/retireLockDirectory";
import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * The on-disk layout of the fenced dependency-build lock, and the one operation
 * that frees it.
 *
 * `<lockDir>/current` is the held generation: a directory carrying its id and
 * its owner. It is only ever freed by renaming it to its deterministic
 * tombstone `<lockDir>/retired/<generation>`, so a late or duplicate retire of
 * an old generation finds the tombstone occupied and fails instead of moving a
 * successor. This mirrors the source-plugin lock protocol.
 */
export namespace DependencyBuildLockProtocol {
  /** Directory name of the held generation inside the lock directory. */
  export const DEP_BUILD_LOCK_CURRENT_DIR = "current";

  /** Directory holding one tombstone per retired generation. */
  export const DEP_BUILD_LOCK_RETIRED_DIR = "retired";

  /** File inside a generation directory holding its hex id. */
  export const DEP_BUILD_LOCK_GENERATION_FILE = "generation";

  /**
   * How long one wait of the lock protocol yields: a waiter's poll of the
   * holder, and a retire's wait for a peer's read of the held generation to end
   * (`retireLockDirectory`).
   */
  export const DEP_BUILD_LOCK_POLL_MS = 50;

  /** File inside a generation directory recording the holder's pid and host. */
  export const DEP_BUILD_LOCK_OWNER_FILE = "owner.json";

  /**
   * Retire `generation` if it is still the held one, by renaming `current` onto
   * its tombstone. Returns `false` when the lock is already free or held by
   * another generation; throws only on an unexpected filesystem error.
   */
  export function retireDependencyBuildLock(
    lockDir: string,
    generation: string,
  ): boolean {
    if (!DependencyBuildGeneration.isDependencyGeneration(generation)) {
      return false;
    }
    const retiredDir = path.join(lockDir, DEP_BUILD_LOCK_RETIRED_DIR);
    try {
      fs.mkdirSync(retiredDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        if (RuntimeFilesystem.isMissingPathError(error)) {
          return false;
        }
        throw error;
      }
    }
    return retireLockDirectory(
      path.join(lockDir, DEP_BUILD_LOCK_CURRENT_DIR),
      path.join(retiredDir, generation),
      () =>
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          DEP_BUILD_LOCK_POLL_MS,
        ),
    );
  }

  /**
   * Render a millisecond duration for lock diagnostics (`137ms`, `42s`, `9m
   * 3s`).
   */
  export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms)) {
      return "an unknown time";
    }
    if (ms < 1_000) {
      return `${Math.max(0, Math.round(ms))}ms`;
    }
    const seconds = Math.floor(ms / 1_000);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes === 0 ? `${seconds}s` : `${minutes}m ${remainder}s`;
  }
}
