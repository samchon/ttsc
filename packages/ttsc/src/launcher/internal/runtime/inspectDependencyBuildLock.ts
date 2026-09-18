import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DependencyBuildLockObservation } from "./DependencyBuildLockObservation";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";
import type { DependencyBuildLockFence } from "./DependencyBuildLockFence";
import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * Classify the current state of a dependency build lock directory. Exported for
 * the deterministic multi-process cache regressions.
 */
export function inspectDependencyBuildLock(
  lockDir: string,
  now: number,
): DependencyBuildLockObservation {
  const currentDir = path.join(lockDir, DependencyBuildLockProtocol.DEP_BUILD_LOCK_CURRENT_DIR);
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
    if (isLocalHostName(owner.hostname) && !isProcessAlive(owner.pid)) {
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
        path.join(generationDir, DependencyBuildLockProtocol.DEP_BUILD_LOCK_OWNER_FILE),
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
        path.join(generationDir, DependencyBuildLockProtocol.DEP_BUILD_LOCK_GENERATION_FILE),
        "utf8",
      )
      .trim();
    return DependencyBuildGeneration.isDependencyGeneration(generation) ? generation : null;
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

function isLocalHostName(hostname: string): boolean {
  return hostname.toLowerCase() === os.hostname().toLowerCase();
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
