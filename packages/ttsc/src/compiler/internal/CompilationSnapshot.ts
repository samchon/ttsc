import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";

/**
 * Own one read-once compiler view across sequential native stages. Its private
 * document stores actual compiler text and lookup answers, including absence;
 * each invocation starts empty and removes its storage after its final stage.
 * Disk freshness remains a separate cache-admission decision.
 *
 * @evidence contracts/common.md#principled-implementation A unique invocation ID and versioned private document share first-read answers through the driver's supported VFS, without changing source paths or the selected compiler.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous owner brackets the sequential compiler operation and its transport cleanup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The driver consumes real captured text; no filesystem methods or compiler internals are replaced.
 * @evidence contracts/common.md#meaningful-documentation Prose states read-once semantics, sequential stage ownership, absence and independent freshness admission.
 * @evidence contracts/portability.md#os-neutral-implementation Native temporary-directory creation and path APIs own transport; environment merging preserves Windows key semantics.
 * @evidence contracts/performance.md#efficient-algorithms Construction writes an empty document; each native stage parses prior captured text/predicates and dirty flushes encode and write the complete reached population. Normal UTF-8 remains plain text, while invalid UTF-8 is encoded losslessly and decoded once per stage.
 * @evidence contracts/performance.md#reuse-equivalent-work Only stages of this invocation share captured answers; unrelated invocations have fresh IDs and documents.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous owner attempts identity-checked cleanup after success or failure; native captured bytes have no population cap. A failed initial identity read or cleanup can leave storage behind; cleanup failure retains the original thrown error or completed result.
 */
export namespace CompilationSnapshot {
  export const ENV = "TTSC_COMPILATION_SNAPSHOT";

  /**
   * Run sequential native stages with a new invocation-owned input document.
   * The supplied environment is copied; same-directory identity guards cleanup,
   * and cleanup failure retains the operation error or completed result.
   *
   * @evidence contracts/common.md#principled-implementation A unique invocation ID and versioned private document share first-read answers through the driver's supported VFS, without changing source paths or the selected compiler.
   * @evidence contracts/common.md#clear-and-simple-design One synchronous owner brackets the sequential compiler operation and its transport cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The driver consumes real captured text; no filesystem methods or compiler internals are replaced.
   * @evidence contracts/common.md#meaningful-documentation Prose states read-once semantics, sequential stage ownership, absence and independent freshness admission.
   * @evidence contracts/portability.md#os-neutral-implementation Native temporary-directory creation and path APIs own transport; environment merging preserves Windows key semantics.
   * @evidence contracts/performance.md#efficient-algorithms Construction writes an empty document; each native stage parses prior captured text/predicates and dirty flushes encode and write the complete reached population. Normal UTF-8 remains plain text, while invalid UTF-8 is encoded losslessly and decoded once per stage.
   * @evidence contracts/performance.md#reuse-equivalent-work Only stages of this invocation share captured answers; unrelated invocations have fresh IDs and documents.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous owner attempts identity-checked cleanup after success or failure; native captured bytes have no population cap. A failed initial identity read or cleanup can leave storage behind; cleanup failure retains the original thrown error or completed result.
   */
  export function run<T>(
    environment: NodeJS.ProcessEnv | undefined,
    operation: (environment: NodeJS.ProcessEnv) => T,
  ): T {
    const directory = createCanonicalTempDirectory("ttsc-input-snapshot-");
    const ownership = fs.lstatSync(directory);
    let completed: T | undefined;
    let failed = false;
    let failure: unknown;
    try {
      const file = path.join(directory, "inputs.json");
      fs.writeFileSync(
        file,
        JSON.stringify({
          version: 1,
          id: crypto.randomUUID(),
          reads: {},
          files: {},
          directories: {},
          entries: {},
          realpaths: {},
          stats: {},
        }),
      );
      const env = SidecarEnvironment.merge(environment, { [ENV]: file });
      completed = operation(env);
      return completed;
    } catch (error) {
      failed = true;
      failure = error;
      throw error;
    } finally {
      try {
        const current = fs.lstatSync(directory);
        if (
          !current.isDirectory() ||
          current.isSymbolicLink() ||
          current.dev !== ownership.dev ||
          current.ino !== ownership.ino
        )
          throw new Error("Compilation snapshot directory ownership changed");
        fs.rmSync(directory, { recursive: true });
      } catch (error) {
        if (failed)
          throw new AggregateError(
            [failure, error],
            "Compilation snapshot and cleanup failed",
            { cause: failure },
          );
        throw new AggregateError(
          [completed, error],
          "Compilation completed but snapshot cleanup failed",
          { cause: completed },
        );
      }
    }
  }
}
