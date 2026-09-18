import fs from "node:fs";
import path from "node:path";

import { prepareExecution } from "./launcher/internal/prepareExecution";
import { type RuntimeManifest } from "./launcher/internal/runtime/RuntimeManifest";
import { installRuntimeHooks } from "./launcher/internal/runtime/installRuntimeHooks";

const cleanupDirectories = new Set<string>();
let runtimeSequence = 0;

/**
 * Prepare one TypeScript root with the same checked compiler pipeline as ttsx,
 * then expose its transient emit to the already-installed runtime hooks.
 */
function prepareEntry(filename: string): RuntimeManifest {
  const execution = prepareExecution(filename, {
    runtimeCacheKey: `register-${process.pid}-${++runtimeSequence}`,
  });
  cleanupDirectories.add(execution.cleanupDir);
  return {
    depCacheDir: path.join(execution.cleanupDir, "deps"),
    emitDir: execution.emitDir,
    entryFile: execution.entryFile,
    entrySource: execution.entrySource,
    outputs: execution.outputs,
    moduleOptions: execution.moduleOptions,
    projectRoot: execution.projectRoot,
    rootDir: execution.rootDir,
  };
}

/** Remove every register-owned transient emit when the JavaScript host exits. */
function cleanupRuntimeOutputs(): void {
  for (const directory of cleanupDirectories) {
    try {
      fs.rmSync(directory, { force: true, recursive: true });
    } catch {
      // Best effort: cleanup must not replace the host process exit status.
    }
  }
  cleanupDirectories.clear();
}

process.once("exit", cleanupRuntimeOutputs);
installRuntimeHooks({ prepareEntry });
