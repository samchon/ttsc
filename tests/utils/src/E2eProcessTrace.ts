import type * as childProcess from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Test-owned primitive adapters shared with actual embedded Node consumers. The
 * module loads one authored CJS runtime and delegates actual operations;
 * prepared tool identity and measurement completeness belong to the
 * coordinator.
 *
 * @evidence contracts/common.md#principled-implementation Exposes owned adapters with original Node signatures and a shared absolute runtime identity; it does not replace native exports or infer child success.
 * @evidence contracts/common.md#clear-and-simple-design One typed facade connects maintained TS callers and explicit plain-Node fixture consumers to the same runtime.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign methods or product APIs are changed; actual process fields and side-channel integrity limits remain separate from expected counts.
 * @evidence contracts/common.md#meaningful-documentation States delegated operation ownership, coordinator identity/completeness responsibilities and fixture preparation timing.
 * @evidence contracts/portability.md#os-neutral-implementation Native URL/path conversion locates the authored runtime; actual process shell/argv/environment/platform behavior remains delegated to the original Node primitive.
 * @evidence contracts/performance.md#efficient-algorithms Module initialization resolves one runtime entry; enabled calls incur event append and bounded selected-file hashing before direct absolute-file operations. Fixture transformations allocate proportional to supplied text bytes.
 * @evidence contracts/performance.md#reuse-equivalent-work Node module loading shares the same runtime instance and nonce; no mutable fixture/process outcome is reused.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Runtime methods synchronously close observation files; exported function references persist with the module, and payload retention/child joins belong to their explicit owners.
 */
export namespace E2eProcessTrace {
  /** Absolute authored runtime entry, usable by a plain Node fixture child. */
  export const runtimePath = fileURLToPath(
    new URL("./internal/E2eProcessTraceRuntime.cjs", import.meta.url),
  );
  const runtime = createRequire(import.meta.url)(runtimePath) as Runtime;
  /** Original Node spawn signature and returned ChildProcess identity. */
  export const spawn: typeof childProcess.spawn = runtime.spawn;
  /** Original Node fork signature and returned IPC child identity. */
  export const fork: typeof childProcess.fork = runtime.fork;
  /** Original callback/child interface, with separate actual lifetime events. */
  export const execFile: typeof childProcess.execFile = runtime.execFile;
  /** Original exec callback/child interface and shell semantics. */
  export const exec: typeof childProcess.exec = runtime.exec;
  /** Original synchronous result including actual PID/status/error fields. */
  export const spawnSync: typeof childProcess.spawnSync = runtime.spawnSync;
  /** Original stdout or result-enriched error, observed through spawnSync. */
  export const execFileSync: typeof childProcess.execFileSync =
    runtime.execFileSync;
  /** Original shell/stdout or result-enriched error interface. */
  export const execSync: typeof childProcess.execSync = runtime.execSync;

  /**
   * Routes explicit authored fixture imports to the same owned runtime before
   * preparation. Literal require overloads change with their matching calls;
   * the actual child operations and all scenario inputs otherwise remain
   * intact.
   *
   * @evidence contracts/common.md#principled-implementation Replaces only the explicit quoted Node child-process module identity with the selected test runtime, preserving matching fixture require declarations and actual primitive calls.
   * @evidence contracts/common.md#clear-and-simple-design One text-input transformation serves explicit fixture consumers without mutating Node exports or adding product configuration.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts It does not synthesize child results or expected trace counts; the returned fixture still performs the real operation through the owned adapter.
   * @evidence contracts/common.md#meaningful-documentation Documents preparation-time source routing, matched type overloads and unchanged scenario inputs.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation transforms authored text only; native process and filesystem semantics remain with their owners.
   * @evidence contracts/performance.md#efficient-algorithms Visits each text input once and replaces exact literal module references; allocations scale with total supplied source bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work All files use the single authored runtime identity; mutable input maps and process outcomes are not cached.
   * @evidence contracts/performance.md#bound-retention-and-release-resources No handles or temporary roots are acquired; transformed text and map ownership transfer to the fixture-preparation caller.
   */
  export function fixtureFiles(
    files: Record<string, string>,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(files).map(([file, text]) => [
        file,
        text.replaceAll('"node:child_process"', JSON.stringify(runtimePath)),
      ]),
    );
  }

  /**
   * Routes only the named, already copied fixture files. It must run before any
   * corresponding child starts, never while a selected producer is live.
   *
   * @evidence contracts/common.md#principled-implementation Reads each explicit copied file and writes the same text with its owned child-process import routed; preparation errors propagate before starting the consumer.
   * @evidence contracts/common.md#clear-and-simple-design Delegates the exact text transformation and leaves root creation, process lifetime and cleanup with the caller.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Paths must remain within the supplied owned root; no native exports, fixture outputs or process observations are replaced.
   * @evidence contracts/common.md#meaningful-documentation States explicit-file selection and the required before-start timing.
   * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and filesystem IO preserve actual copied paths without shell commands or case folding.
   * @evidence contracts/performance.md#efficient-algorithms Reads and transforms each named file once, with complete UTF8 buffers proportional to its actual bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work Uses the same runtime identity and text transformer; does not cache mutable fixture contents.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous file methods close before return; writes belong to the caller's existing root and no additional temporary storage is acquired.
   */
  export function fixturePaths(root: string, files: readonly string[]): void {
    const owned = path.resolve(root);
    for (const file of files) {
      const target = path.resolve(owned, file);
      const relative = path.relative(owned, target);
      if (
        relative === ".." ||
        relative.startsWith(".." + path.sep) ||
        path.isAbsolute(relative)
      )
        throw new Error("Trace fixture path escapes its owner: " + file);
      const text = fs.readFileSync(target, "utf8");
      fs.writeFileSync(target, fixtureFiles({ [file]: text })[file]!);
    }
  }
}

type Runtime = Pick<
  typeof childProcess,
  | "spawn"
  | "fork"
  | "exec"
  | "execFile"
  | "spawnSync"
  | "execFileSync"
  | "execSync"
>;
