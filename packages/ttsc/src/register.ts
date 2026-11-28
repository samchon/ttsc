import fs from "node:fs";
import path from "node:path";

import { RuntimeBuildCache } from "./compiler/internal/build/RuntimeBuildCache";
import { RuntimeEmitBundle } from "./compiler/internal/build/RuntimeEmitBundle";
import { prepareExecution } from "./launcher/internal/prepareExecution";
import { type RuntimeManifest } from "./launcher/internal/runtime/RuntimeManifest";
import { installRuntimeHooks } from "./launcher/internal/runtime/installRuntimeHooks";
import { runtimeRunKey } from "./launcher/internal/runtime/runtimeRunKey";
import { systemRuntimeRunTree } from "./launcher/internal/runtime/systemRuntimeRunTree";
import { withRuntimeDirectoryLock } from "./launcher/internal/runtime/withRuntimeDirectoryLock";

const cleanupDirectories = new Map<
  string,
  {
    canChange?: (directory: string) => boolean;
    manifest: RuntimeManifest;
    runtimeRoot: string;
    buildStore?: string;
  }
>();
let runtimeSequence = 0;

/**
 * Prepare one TypeScript root with the same checked compiler pipeline as ttsx,
 * then expose its transient emit to the already-installed runtime hooks.
 *
 * The process-run key and sequence distinguish prepared roots. Installed hooks
 * own same-root reuse; this adapter only transfers the existing emit manifest.
 * Each prepared directory is retained until host exit, so long sessions can
 * accumulate roots without an earlier eviction boundary.
 */
function prepareEntry(filename: string): RuntimeManifest {
  const execution = prepareExecution(filename, {
    runtimeCacheKey: `register-${runtimeRunKey()}-${++runtimeSequence}`,
  });
  const manifest: RuntimeManifest = {
    depCacheDir: path.join(execution.cleanupDir, "deps"),
    emitDir: execution.emitDir,
    bundledOutputs: execution.bundledOutputs,
    emittedSources: execution.emittedSources,
    emittedSourceProofFailures: execution.emittedSourceProofFailures,
    entryFile: execution.entryFile,
    entrySource: execution.entrySource,
    outputs: execution.outputs,
    moduleOptions: execution.moduleOptions,
    orphanCacheDir: execution.orphanCacheDir,
    projectRoot: execution.projectRoot,
    systemProjectRoots: execution.systemProjectRoots,
    rootDir: execution.rootDir,
  };
  cleanupDirectories.set(execution.cleanupDir, {
    canChange: execution.canChangeRuntimeRun,
    manifest,
    runtimeRoot: execution.runtimeCacheDir,
    buildStore: execution.runtimeBuildCacheDir,
  });
  return manifest;
}

/**
 * Remove every register-owned transient emit when the JavaScript host exits.
 * Cleanup is best-effort and does not override the host's exit status.
 *
 * Each recorded transient tree is visited once. Under the system cache lock, an
 * eligible run can return its adopted outputs before deletion. Failed cleanup
 * may leave disk output, and abrupt process termination can bypass this
 * callback.
 */
function cleanupRuntimeOutputs(): void {
  for (const [
    directory,
    { canChange, manifest, runtimeRoot, buildStore },
  ] of cleanupDirectories) {
    try {
      const remove = () => {
        if (
          systemRuntimeRunTree(directory, canChange, manifest) === "protected"
        )
          return;
        if (canChange !== undefined && buildStore !== undefined) {
          RuntimeEmitBundle.release();
          RuntimeBuildCache.parkRequested(directory, buildStore, canChange);
        }
        fs.rmSync(directory, { force: true, recursive: true });
      };
      if (canChange !== undefined && buildStore !== undefined) {
        if (canChange(directory)) withRuntimeDirectoryLock(runtimeRoot, remove);
      } else remove();
    } catch {
      // Best effort: cleanup must not replace the host process exit status.
    }
  }
  cleanupDirectories.clear();
}

process.once("exit", cleanupRuntimeOutputs);
installRuntimeHooks({ prepareEntry });
