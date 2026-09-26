import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { PluginBuildLockFence } from "./PluginBuildLockFence";
import type { PluginBuildLockObservation } from "./PluginBuildLockObservation";
import { PluginBuildLockOwner } from "./PluginBuildLockOwner";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";
import { formatDuration } from "./formatDuration";

/**
 * Classify the current state of a plugin build lock directory.
 *
 * Exported for unit tests.
 */
export function inspectPluginBuildLock(
  lockDir: string,
  now: number,
): PluginBuildLockObservation {
  const protocolDir =
    PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir);
  for (;;) {
    if (PluginBuildLockProtocol.isPluginBuildLockProtocolV2(protocolDir)) {
      const v2 = inspectV2PluginBuildLock(protocolDir, now);
      if (v2.state !== "released") {
        return v2;
      }
    }
    const legacy = captureLegacyPluginBuildLockFence(lockDir);
    if (legacy !== null) {
      return inspectLegacyPluginBuildLock(lockDir, now, legacy);
    }
    if (pluginBuildLockAgeMs(lockDir, now) === null) {
      return { state: "released" };
    }
    // The path changed while its legacy fence was being captured. Re-observe
    // the replacement rather than attaching the old state to a new owner.
  }
}

const PLUGIN_BUILD_LOCK_LEGACY_STALE_MS = 30_000;

function inspectV2PluginBuildLock(
  lockDir: string,
  now: number,
): PluginBuildLockObservation {
  const generationDir = path.join(
    lockDir,
    PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_CURRENT_DIR,
  );
  const generation = readPluginBuildLockGeneration(generationDir);
  if (generation === null) {
    if (pluginBuildLockAgeMs(generationDir, now) === null) {
      return { state: "released" };
    }
    throw new Error(
      `ttsc plugin build lock has no valid ${PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_GENERATION_FILE}: ${generationDir}`,
    );
  }
  const fence: PluginBuildLockFence = { protocol: "v2", generation };
  const owner = PluginBuildLockOwner.read(generationDir);
  if (owner !== null) {
    const label = PluginBuildLockOwner.describe(owner);
    if (PluginBuildLockOwner.gone(owner)) {
      return {
        state: "abandoned",
        reason: `${label} is no longer running`,
        fence,
      };
    }
    return {
      state: "active",
      owner: label,
      fence,
    };
  }

  const ageMs = pluginBuildLockAgeMs(generationDir, now);
  if (ageMs === null) {
    return { state: "released" };
  }
  if (ageMs > PLUGIN_BUILD_LOCK_LEGACY_STALE_MS) {
    return {
      state: "abandoned",
      reason:
        `lock generation has no ${PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE} and is ` +
        `${formatDuration(ageMs)} old`,
      fence,
    };
  }
  return {
    state: "active",
    owner: `lock generation with no ${PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE}`,
    fence,
  };
}

function inspectLegacyPluginBuildLock(
  lockDir: string,
  now: number,
  legacy: PluginBuildLockProtocol.LegacyPluginBuildLockFence,
): PluginBuildLockObservation {
  const owner = PluginBuildLockOwner.read(lockDir);
  if (owner !== null) {
    const label = PluginBuildLockOwner.describe(owner);
    if (PluginBuildLockOwner.gone(owner)) {
      return {
        state: "abandoned",
        reason: `${label} is no longer running`,
        fence: legacy.fence,
      };
    }
    return {
      state: "active",
      owner: label,
      fence: legacy.fence,
    };
  }

  const ageMs = Math.max(0, now - legacy.legacyMtimeMs);
  if (ageMs > PLUGIN_BUILD_LOCK_LEGACY_STALE_MS) {
    return {
      state: "abandoned",
      reason:
        `legacy lock has no ${PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE} and is ` +
        `${formatDuration(ageMs)} old`,
      fence: legacy.fence,
    };
  }
  return {
    state: "active",
    owner: `legacy lock with no ${PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE}`,
    fence: legacy.fence,
  };
}

function captureLegacyPluginBuildLockFence(
  lockDir: string,
): PluginBuildLockProtocol.LegacyPluginBuildLockFence | null {
  if (PluginBuildLockProtocol.isPluginBuildLockProtocolV2(lockDir)) {
    return null;
  }

  let legacyMtimeMs: number;
  try {
    legacyMtimeMs = fs.statSync(lockDir).mtimeMs;
  } catch (error) {
    if (PluginBuildLockProtocol.isMissingPathError(error)) return null;
    throw error;
  }

  const fenceDir = path.join(
    lockDir,
    PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_LEGACY_FENCE_DIR,
  );
  let captured =
    PluginBuildLockProtocol.readLegacyPluginBuildLockFence(fenceDir);
  if (captured === null) {
    const generation = crypto.randomBytes(16).toString("hex");
    // Keep candidates beside the legacy lock. Creating one inside `lockDir`
    // would advance its mtime before a contender publishes the shared fence;
    // a concurrent contender could then record an old lock as freshly created.
    const candidateDir = `${lockDir}.legacy-candidate-${generation}`;
    try {
      fs.mkdirSync(candidateDir);
      fs.writeFileSync(
        path.join(
          candidateDir,
          PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_LEGACY_FENCE_RECORD,
        ),
        `${JSON.stringify({ generation, legacyMtimeMs })}\n`,
        "utf8",
      );
      try {
        fs.renameSync(candidateDir, fenceDir);
        captured = {
          fence: { protocol: "legacy", generation },
          legacyMtimeMs,
        };
      } catch (error) {
        if (
          PluginBuildLockProtocol.isRenameDestinationOccupied(error, fenceDir)
        ) {
          captured =
            PluginBuildLockProtocol.readLegacyPluginBuildLockFence(fenceDir);
        } else if (PluginBuildLockProtocol.isMissingPathError(error)) {
          return null;
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (PluginBuildLockProtocol.isMissingPathError(error)) {
        return null;
      }
      throw error;
    } finally {
      fs.rmSync(candidateDir, { force: true, recursive: true });
    }
  }
  if (captured === null) {
    throw new Error(`invalid legacy plugin build lock fence: ${fenceDir}`);
  }

  // A stale observer can resume after the legacy holder released or another
  // process retired the path. Confirm both the legacy layout and token after
  // publication; v2 ownership is kept in the orthogonal sibling directory.
  const confirmed =
    PluginBuildLockProtocol.readLegacyPluginBuildLockFence(fenceDir);
  if (
    PluginBuildLockProtocol.isPluginBuildLockProtocolV2(lockDir) ||
    confirmed === null ||
    confirmed.fence.generation !== captured.fence.generation
  ) {
    return null;
  }
  return captured;
}

function readPluginBuildLockGeneration(generationDir: string): string | null {
  try {
    const generation = fs
      .readFileSync(
        path.join(
          generationDir,
          PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_GENERATION_FILE,
        ),
        "utf8",
      )
      .trim();
    return PluginBuildLockProtocol.isPluginBuildLockGeneration(generation)
      ? generation
      : null;
  } catch {
    return null;
  }
}

/**
 * Age of an observed lock directory, or `null` when it no longer exists. The
 * holder may have retired it between the caller's checks. "Missing" is a
 * observation, never encoded as a numeric age: the previous
 * `Number.POSITIVE_INFINITY` encoding made a just-released lock look like an
 * infinitely old abandoned legacy lock (issue #421).
 *
 * A stat failure that does not prove absence (e.g. `EPERM`) clamps to age 0:
 * the lock is treated as fresh so a waiter never steals on ambiguous evidence,
 * while the caller's wait budget still bounds the stall.
 */
function pluginBuildLockAgeMs(lockDir: string, now: number): number | null {
  try {
    return Math.max(0, now - fs.statSync(lockDir).mtimeMs);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR" ? null : 0;
  }
}

