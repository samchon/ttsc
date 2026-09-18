import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DependencyBuildLockLease } from "./DependencyBuildLockLease";
import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * Atomically acquire the current generation of a dependency build lock, or
 * `null` when another process already holds it. Exported for the deterministic
 * multi-process cache regressions.
 */
export function acquireDependencyBuildLock(
  lockDir: string,
): DependencyBuildLockLease | null {
  ensureDependencyLockRoot(lockDir);
  const generation = DependencyBuildGeneration.newDependencyGeneration();
  const candidateDir = path.join(lockDir, `candidate-${generation}`);
  fs.mkdirSync(candidateDir);
  try {
    fs.writeFileSync(
      path.join(candidateDir, DependencyBuildLockProtocol.DEP_BUILD_LOCK_GENERATION_FILE),
      `${generation}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    writeDependencyLockOwner(candidateDir, generation);
    const currentDir = path.join(lockDir, DependencyBuildLockProtocol.DEP_BUILD_LOCK_CURRENT_DIR);
    try {
      fs.renameSync(candidateDir, currentDir);
    } catch (error) {
      if (
        RuntimeFilesystem.isMissingPathError(error) ||
        RuntimeFilesystem.isRenameDestinationOccupied(error, currentDir)
      ) {
        return null;
      }
      throw error;
    }
    return { generation };
  } finally {
    // The candidate name carries this process's random generation and can never
    // alias `current` or another contender's candidate.
    fs.rmSync(candidateDir, { force: true, recursive: true });
  }
}

function ensureDependencyLockRoot(lockDir: string): void {
  fs.mkdirSync(path.join(lockDir, DependencyBuildLockProtocol.DEP_BUILD_LOCK_RETIRED_DIR), {
    recursive: true,
  });
}

function writeDependencyLockOwner(
  generationDir: string,
  generation: string,
): void {
  fs.writeFileSync(
    path.join(generationDir, DependencyBuildLockProtocol.DEP_BUILD_LOCK_OWNER_FILE),
    `${JSON.stringify({
      generation,
      hostname: os.hostname(),
      pid: process.pid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );
}
