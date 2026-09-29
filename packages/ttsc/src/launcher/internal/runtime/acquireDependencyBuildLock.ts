import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isContendedCandidateRename } from "../../../internal/isContendedCandidateRename";
import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import type { DependencyBuildLockLease } from "./DependencyBuildLockLease";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * Atomically acquire the current generation of a dependency build lock, or
 * `null` when another process already holds it or the candidate loses its
 * publication race. Unexpected filesystem errors propagate.
 *
 * @evidence contracts/common.md#principled-implementation A private candidate contains its generation and owner before directory rename publishes current; a nonempty held directory prevents replacement, giving the winner a fully initialized lease.
 * @evidence contracts/common.md#clear-and-simple-design Candidate preparation, atomic publication and unconditional candidate cleanup define one acquisition operation; layout and native contention classification use shared owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Acquisition uses a real atomic filesystem boundary rather than an empty-owner window, fixture schedule or ignored unexpected error.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents null contention and propagated errors, while the cleanup comment explains why the private candidate cannot select current or another contender.
 * @evidence contracts/portability.md#os-neutral-implementation Node fs/path supply native directory operations; isContendedCandidateRename owns supported Windows and POSIX contention codes instead of this operation guessing from an OS label.
 * @evidence contracts/performance.md#efficient-algorithms Acquisition performs a fixed number of directory and small-record operations; it neither scans historical tombstones nor spins while a holder is active.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Acquisition changes lock ownership and cannot reuse a past lease; the higher-level build coordinator owns shared compilation.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources The call owns one candidate directory and removes its unused name in finally; successful rename transfers the generation to the lease holder, whose release or dead-owner recovery retires it. A forced kill before publication can leave a candidate until its cache container is removed.
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
      path.join(
        candidateDir,
        DependencyBuildLockProtocol.DEP_BUILD_LOCK_GENERATION_FILE,
      ),
      `${generation}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    writeDependencyLockOwner(candidateDir, generation);
    const currentDir = path.join(
      lockDir,
      DependencyBuildLockProtocol.DEP_BUILD_LOCK_CURRENT_DIR,
    );
    try {
      fs.renameSync(candidateDir, currentDir);
    } catch (error) {
      if (
        RuntimeFilesystem.isMissingPathError(error) ||
        isContendedCandidateRename(error)
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
  fs.mkdirSync(
    path.join(lockDir, DependencyBuildLockProtocol.DEP_BUILD_LOCK_RETIRED_DIR),
    {
      recursive: true,
    },
  );
}

function writeDependencyLockOwner(
  generationDir: string,
  generation: string,
): void {
  fs.writeFileSync(
    path.join(
      generationDir,
      DependencyBuildLockProtocol.DEP_BUILD_LOCK_OWNER_FILE,
    ),
    `${JSON.stringify({
      generation,
      hostname: os.hostname(),
      pid: process.pid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );
}
