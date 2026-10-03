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
 * Publication assumes a preserved lock namespace and a noncolliding generated
 * candidate identity. Native failures before/after rename can leave persisted
 * state: finally attempts candidate removal, and a cleanup error can propagate
 * after current was published but before a lease reaches the caller.
 *
 * @evidence contracts/common.md#principled-implementation A private candidate contains its generation and owner before directory rename publishes current; a nonempty held directory prevents replacement, giving the winner a fully initialized lease.
 * @evidence contracts/common.md#clear-and-simple-design Candidate preparation, native rename publication and finally removal attempts define one acquisition operation; layout and contention classification use shared owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Acquisition uses a real atomic filesystem boundary rather than an empty-owner window, fixture schedule or ignored unexpected error.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents null contention and propagated errors, while the cleanup comment explains why the private candidate cannot select current or another contender.
 * @evidence contracts/portability.md#os-neutral-implementation Node fs/path supply native directory operations; isContendedCandidateRename owns supported Windows and POSIX contention codes instead of this operation guessing from an OS label.
 * @evidence contracts/performance.md#efficient-algorithms Fixed operation count still pays path text/parent depth, generation entropy/hex, hostname/pid/timestamp JSON bytes and native create/write/rename/removal. No tombstone-history scan or holder wait is performed here; native latency and cleanup entry work are not constant-time certificates.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Acquisition changes lock ownership and cannot reuse a past lease; the higher-level build coordinator owns shared compilation.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Finally attempts candidate cleanup; returning a successful lease transfers current to its holder. Cleanup failure can leave a candidate or published current before caller lease transfer, and forced termination can strand state. Recovery/container removal own later reclamation; this call has no historical quota or cleanup deadline.
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
    // The candidate prefix cannot name `current`; exclusive ownership of this
    // created candidate and noncolliding generations remain protocol premises.
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
