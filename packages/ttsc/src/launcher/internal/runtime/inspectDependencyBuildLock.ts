import fs from "node:fs";
import path from "node:path";

import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import type { DependencyBuildLockFence } from "./DependencyBuildLockFence";
import type { DependencyBuildLockObservation } from "./DependencyBuildLockObservation";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";
import { RuntimeFilesystem } from "./RuntimeFilesystem";
import { isLocalProcessGone } from "./isLocalProcessGone";

/**
 * Classify the current state of a dependency build lock directory.
 *
 * Unreadable generation identity is active uncertainty. A readable owner is
 * abandoned only when the local pid is provably gone; an ownerless generation
 * becomes recoverable after the protocol's stale interval.
 *
 * @evidence contracts/common.md#principled-implementation Generation identity fences every holder observation; a valid owner requires conservative local liveness evidence, while missing owner data uses the explicit stale-generation policy without stealing an unreadable identity.
 * @evidence contracts/common.md#clear-and-simple-design Separate generation, owner, age and label helpers supply one state classifier; the discriminated result makes recovery authority explicit to callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture age or broad pid-probe failure marks a valid owner dead; ownerless recovery is the protocol's supported corruption policy rather than a fabricated lease.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe uncertainty and recovery grounds, and the acquisition-order comment explains why an unreadable generation cannot be stolen safely.
 * @evidence contracts/portability.md#os-neutral-implementation Node fs, native path joins and isLocalProcessGone supply directory age and host-scoped pid identity; absence errno differs from denied access without OS-name assumptions.
 * @evidence contracts/performance.md#efficient-algorithms Classification reads two fixed-size records and at most one stat, independent of retired-generation count; no directory-wide scan occurs per poll.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Lock state changes between observations, so an earlier classification cannot replace a fresh recovery decision.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous record reads retain no handle or history; the returned fence transfers an observation to its caller without owning the lock.
 */
export function inspectDependencyBuildLock(
  lockDir: string,
  now: number,
): DependencyBuildLockObservation {
  const currentDir = path.join(
    lockDir,
    DependencyBuildLockProtocol.DEP_BUILD_LOCK_CURRENT_DIR,
  );
  const generation = readDependencyLockGeneration(currentDir);
  if (generation === null) {
    if (dependencyLockAgeMs(currentDir, now) === null) {
      return { state: "released" };
    }
    // `current` exists without a readable generation id. Acquisition writes the
    // id into the candidate BEFORE the atomic rename, so this is a transient or
    // corrupt state; keep waiting rather than steal on ambiguous evidence.
    return {
      state: "active",
      owner: "lock generation without a readable id",
      fence: { generation: "" },
    };
  }
  const fence: DependencyBuildLockFence = { generation };
  const owner = readDependencyLockOwner(currentDir);
  if (owner !== null) {
    const label = describeDependencyLockOwner(owner);
    if (isLocalProcessGone(owner)) {
      return {
        state: "abandoned",
        reason: `${label} is no longer running`,
        fence,
      };
    }
    return { state: "active", owner: label, fence };
  }
  const ageMs = dependencyLockAgeMs(currentDir, now);
  if (ageMs === null) {
    return { state: "released" };
  }
  if (ageMs > DEP_BUILD_LOCK_STALE_MS) {
    return {
      state: "abandoned",
      reason: `lock generation has no ${DependencyBuildLockProtocol.DEP_BUILD_LOCK_OWNER_FILE} and is ${DependencyBuildLockProtocol.formatDuration(
        ageMs,
      )} old`,
      fence,
    };
  }
  return {
    state: "active",
    owner: `lock generation with no ${DependencyBuildLockProtocol.DEP_BUILD_LOCK_OWNER_FILE}`,
    fence,
  };
}

const DEP_BUILD_LOCK_STALE_MS = 30_000;

interface DependencyLockOwner {
  hostname: string;
  pid: number;
  startedAt?: string;
}

function readDependencyLockOwner(
  generationDir: string,
): DependencyLockOwner | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(
        path.join(
          generationDir,
          DependencyBuildLockProtocol.DEP_BUILD_LOCK_OWNER_FILE,
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    if (
      typeof parsed.hostname !== "string" ||
      typeof parsed.pid !== "number" ||
      !Number.isInteger(parsed.pid) ||
      parsed.pid <= 0
    ) {
      return null;
    }
    return {
      hostname: parsed.hostname,
      pid: parsed.pid,
      startedAt:
        typeof parsed.startedAt === "string" ? parsed.startedAt : undefined,
    };
  } catch {
    return null;
  }
}

function readDependencyLockGeneration(generationDir: string): string | null {
  try {
    const generation = fs
      .readFileSync(
        path.join(
          generationDir,
          DependencyBuildLockProtocol.DEP_BUILD_LOCK_GENERATION_FILE,
        ),
        "utf8",
      )
      .trim();
    return DependencyBuildGeneration.isDependencyGeneration(generation)
      ? generation
      : null;
  } catch {
    return null;
  }
}

/** Age of an observed lock directory, or `null` when it no longer exists. */
function dependencyLockAgeMs(
  generationDir: string,
  now: number,
): number | null {
  try {
    return Math.max(0, now - fs.statSync(generationDir).mtimeMs);
  } catch (error) {
    return RuntimeFilesystem.isMissingPathError(error) ? null : 0;
  }
}

function describeDependencyLockOwner(owner: DependencyLockOwner): string {
  const started =
    owner.startedAt === undefined ? "" : ` started at ${owner.startedAt}`;
  return `pid ${owner.pid} on ${owner.hostname}${started}`;
}
