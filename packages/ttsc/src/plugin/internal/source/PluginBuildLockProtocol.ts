import fs from "node:fs";
import path from "node:path";

import type { PluginBuildLockFence } from "./PluginBuildLockFence";

/**
 * The on-disk layout of the source-plugin build lock and the primitives every
 * lock operation shares.
 *
 * A cold source-plugin build is a multi-second-to-minutes `go build`. When a
 * program fans out into many processes (a `pnpm -r` running suites in
 * parallel, a benchmark, a worker pool), each inherits the same cold cache and
 * would otherwise build the same cache key at the same instant. The lock lets
 * one process build while the rest wait for its published binary.
 *
 * Two protocols coexist. The current one (v2) lives in `<lockDir>.v2`: its
 * held generation is `current/`, carrying a generation id and an owner, and it
 * is freed only by renaming `current/` onto the tombstone
 * `retired/<generation>`, so a stale releaser can never free a successor. The
 * legacy protocol held `<lockDir>` itself; a v2 process still recognizes and
 * reclaims an abandoned legacy lock, fenced by the legacy directory's mtime.
 */
export namespace PluginBuildLockProtocol {
/**
 * How long a waiter trusts a live-looking holder before stealing the lock. It
 * matches the ttsx dependency-build lock (`DependencyBuildLockProtocol`), so a
 * crashed builder never wedges a fan-out for longer than ten minutes.
 */
export const PLUGIN_BUILD_LOCK_STEAL_MS = 600_000;

/** File inside a generation directory recording the holder's pid and host. */
export const PLUGIN_BUILD_LOCK_OWNER_FILE = "owner.json";

/** Marker file whose exact content proves a directory speaks protocol v2. */
export const PLUGIN_BUILD_LOCK_PROTOCOL_FILE = "protocol-v2";

/** File inside a generation directory holding its hex id. */
export const PLUGIN_BUILD_LOCK_GENERATION_FILE = "generation";

/** Directory recording the fence of a captured legacy lock. */
export const PLUGIN_BUILD_LOCK_LEGACY_FENCE_DIR = "legacy-generation";

/** File inside the legacy fence directory holding its generation and mtime. */
export const PLUGIN_BUILD_LOCK_LEGACY_FENCE_RECORD = "fence.json";

/** Directory name of the held v2 generation. */
export const PLUGIN_BUILD_LOCK_CURRENT_DIR = "current";

/** Directory holding one tombstone per retired v2 generation. */
export const PLUGIN_BUILD_LOCK_RETIRED_DIR = "retired";

const PLUGIN_BUILD_LOCK_V2_SUFFIX = ".v2";

/** Exact content of the protocol marker file. */
export const PLUGIN_BUILD_LOCK_PROTOCOL = "ttsc-plugin-build-lock-v2\n";

/** The v2 lock directory that belongs to a legacy lock path. */
export function pluginBuildLockProtocolDir(lockDir: string): string {
  return `${lockDir}${PLUGIN_BUILD_LOCK_V2_SUFFIX}`;
}

/**
 * Whether `lockDir` is a real directory (not a link) whose protocol marker has
 * exactly the v2 content.
 */
export function isPluginBuildLockProtocolV2(lockDir: string): boolean {
  try {
    const stats = fs.lstatSync(lockDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) return false;
    return (
      fs.readFileSync(
        path.join(lockDir, PLUGIN_BUILD_LOCK_PROTOCOL_FILE),
        "utf8",
      ) === PLUGIN_BUILD_LOCK_PROTOCOL
    );
  } catch {
    return false;
  }
}

/**
 * Retire `generation` if it is still the held v2 one, by renaming `current/`
 * onto its tombstone. Returns `false` when the lock is already free or held by
 * another generation; throws only on an unexpected filesystem error.
 */
export function retireV2PluginBuildLock(lockDir: string, generation: string): boolean {
  if (!isPluginBuildLockGeneration(generation)) return false;
  const retiredDir = path.join(lockDir, PLUGIN_BUILD_LOCK_RETIRED_DIR);
  try {
    fs.mkdirSync(retiredDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      if (isMissingPathError(error)) return false;
      throw error;
    }
  }

  const destination = path.join(retiredDir, generation);
  try {
    fs.renameSync(
      path.join(lockDir, PLUGIN_BUILD_LOCK_CURRENT_DIR),
      destination,
    );
    return true;
  } catch (error) {
    if (
      isMissingPathError(error) ||
      isRenameDestinationOccupied(error, destination)
    ) {
      return false;
    }
    throw error;
  }
}

/** Whether an error means the path, or one of its parents, does not exist. */
export function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * Whether a failed rename means the destination already exists. Windows
 * reports an occupied directory destination as `EACCES` or `EPERM`, so those
 * count only when the destination is actually present.
 */
export function isRenameDestinationOccupied(
  error: unknown,
  destination: string,
): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EEXIST" || code === "ENOTEMPTY") {
    return true;
  }
  return (code === "EACCES" || code === "EPERM") && fs.existsSync(destination);
}

/** The recorded fence of a legacy lock a v2 process captured for reclaim. */
export interface LegacyPluginBuildLockFence {
  /** The fence handed to the reclaimer, tagged as the legacy protocol. */
  fence: PluginBuildLockFence;
  /**
   * The legacy lock directory's mtime when the fence was first captured. An
   * ownerless legacy lock's age is measured from it, because recording the
   * fence inside the lock directory advances that directory's mtime and would
   * otherwise make an old lock look freshly created.
   */
  legacyMtimeMs: number;
}

/** Read a captured legacy fence, or `null` when absent or malformed. */
export function readLegacyPluginBuildLockFence(
  fenceDir: string,
): LegacyPluginBuildLockFence | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(
        path.join(fenceDir, PLUGIN_BUILD_LOCK_LEGACY_FENCE_RECORD),
        "utf8",
      ),
    ) as Record<string, unknown>;
    if (
      !isPluginBuildLockGeneration(parsed.generation) ||
      typeof parsed.legacyMtimeMs !== "number" ||
      !Number.isFinite(parsed.legacyMtimeMs) ||
      parsed.legacyMtimeMs < 0
    ) {
      return null;
    }
    return {
      fence: { protocol: "legacy", generation: parsed.generation },
      legacyMtimeMs: parsed.legacyMtimeMs,
    };
  } catch {
    return null;
  }
}

/** True for a well-formed 128-bit hex lock generation. */
export function isPluginBuildLockGeneration(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}

/** Block the current (synchronous) thread for `ms` without busy-spinning. */
export function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
}
