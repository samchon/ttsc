import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isContendedCandidateRename } from "../../../internal/isContendedCandidateRename";
import type { PluginBuildLockFence } from "./PluginBuildLockFence";
import type { PluginBuildLockObservation } from "./PluginBuildLockObservation";
import { PluginBuildLockOwner } from "./PluginBuildLockOwner";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * Classify the current state of a plugin build lock directory.
 *
 * Occupied v3 observations register this process as a fence holder and confirm
 * the generation before returning. These records move into its tombstone and
 * remain until the observer is provably gone. No heartbeat or timeout
 * establishes that a live observer cannot act.
 *
 * An owner record whose generation is missing or mismatched remains active and
 * inconclusive: another generation's absent PID cannot authorize this one.
 * Unusable owner metadata also remains inconclusive regardless of age. Ordinary
 * v3 publication includes the complete owner record; old legacy builders could
 * continue after best-effort owner publication failed.
 *
 * @evidence contracts/common.md#principled-implementation An observer is registered under a captured generation before owner classification; generation rechecks prevent a replacement from inheriting the captured fence, whose reserved retirement destination survives the builder's death.
 * @evidence contracts/common.md#clear-and-simple-design Protocol selection, generation observation and legacy fence capture have separate helpers; the public result distinguishes absence from active and abandoned ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A replaced generation causes re-observation or a released handoff; ambiguous process errors are not interpreted as death, and observer age cannot replace liveness proof.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe observer registration, token retention and inconclusive owner metadata before the tags; private comments explain generation races and legacy record compatibility.
 * @evidence contracts/portability.md#os-neutral-implementation Node filesystem and path APIs carry native access, while ESRCH-only local probing distinguishes absent processes from permission failure or remote identity.
 * @evidence contracts/performance.md#efficient-algorithms Each stable observation uses direct paths without scanning generation directories; costs include native path resolution and protocol/generation/owner/fence JSON bytes, hostname checks and optional liveness probes. Publication adds candidate writes/rename/recursive cleanup. Failed v3 registration or changing legacy capture can re-enter the synchronous loop, which has no attempt or elapsed-time bound here.
 * @evidence contracts/performance.md#reuse-equivalent-work A module's nonce shares one observer registration across polls of the same generation; liveness and current identity remain freshly observed because they can change between requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Candidate records have finally cleanup that can fail, including after publication. Published records remain under the cooperating collector policy until observer absence is proven; distinct generations observed by live/unknown processes have no count or age bound here. Continued pathname churn may retain this synchronous observation without a deadline; it starts no asynchronous task.
 */
export function inspectPluginBuildLock(
  lockDir: string,
): PluginBuildLockObservation {
  const protocolDir =
    PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir);
  for (;;) {
    if (PluginBuildLockProtocol.isPluginBuildLockProtocolV3(protocolDir)) {
      const current = inspectV3PluginBuildLock(protocolDir);
      if (current.state !== "released") {
        return current;
      }
    }
    const legacy = captureLegacyPluginBuildLockFence(lockDir);
    if (legacy !== null) {
      return inspectLegacyPluginBuildLock(lockDir, legacy);
    }
    if (pluginBuildLockPathMissing(lockDir)) {
      return { state: "released" };
    }
    // The path changed while its legacy fence was being captured. Re-observe
    // the replacement rather than attaching the old state to a new owner.
  }
}

// Each loaded module records one observer per generation. A random process
// incarnation token keeps a reused PID or another worker's module separate.
const PLUGIN_BUILD_LOCK_OBSERVER = crypto.randomBytes(16).toString("hex");

function inspectV3PluginBuildLock(lockDir: string): PluginBuildLockObservation {
  const generationDir = path.join(
    lockDir,
    PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_CURRENT_DIR,
  );
  const generation = readPluginBuildLockGeneration(generationDir);
  if (generation === null) {
    if (pluginBuildLockPathMissing(generationDir)) {
      return { state: "released" };
    }
    throw new Error(
      `ttsc plugin build lock has no valid ${PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_GENERATION_FILE}: ${generationDir}`,
    );
  }
  if (!registerPluginBuildLockObserver(lockDir, generationDir, generation)) {
    return { state: "released" };
  }
  const fence: PluginBuildLockFence = { protocol: "v3", generation };
  const owner = PluginBuildLockOwner.read(generationDir);
  // Owner and generation are read through a mutable current pathname. A
  // replacement must not inherit an earlier generation's liveness decision.
  if (readPluginBuildLockGeneration(generationDir) !== generation) {
    return { state: "released" };
  }
  if (owner !== null) {
    const label = PluginBuildLockOwner.describe(owner);
    if (owner.generation !== generation) {
      return {
        state: "active",
        owner: `${label} with unconfirmed generation metadata`,
        fence,
      };
    }
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

  // Normal v3 publication includes a complete owner record. Its absence or
  // unreadability is inconclusive, not a creator window that age can expire.
  return {
    state: "active",
    owner: `lock generation with unconfirmed ${PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE}`,
    fence,
  };
}

/**
 * Publish this process's fence ownership before returning an observation. A
 * claim moves with current into its tombstone. Retirement prevents further
 * claims from entering that old generation, so collection sees a closed set.
 */
function registerPluginBuildLockObserver(
  protocolDir: string,
  generationDir: string,
  generation: string,
): boolean {
  const observers = path.join(
    generationDir,
    PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OBSERVERS_DIR,
  );
  const observer = path.join(observers, PLUGIN_BUILD_LOCK_OBSERVER);
  try {
    fs.mkdirSync(observers);
  } catch (error) {
    if (PluginBuildLockProtocol.isMissingPathError(error)) return false;
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!fs.existsSync(observer)) {
    const candidate = path.join(
      protocolDir,
      `observer-candidate-${PLUGIN_BUILD_LOCK_OBSERVER}-${generation}`,
    );
    fs.mkdirSync(candidate);
    try {
      fs.writeFileSync(
        path.join(
          candidate,
          PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE,
        ),
        `${JSON.stringify({ hostname: os.hostname(), pid: process.pid })}\n`,
        { encoding: "utf8", flag: "wx" },
      );
      try {
        fs.renameSync(candidate, observer);
      } catch (error) {
        if (PluginBuildLockProtocol.isMissingPathError(error)) return false;
        if (
          !PluginBuildLockProtocol.isRenameDestinationOccupied(error, observer)
        )
          throw error;
      }
    } finally {
      fs.rmSync(candidate, { force: true, recursive: true });
    }
  }
  // A claim accidentally published into a successor cannot authorize the old
  // fence. Its harmless extra record is collected when this process exits.
  return readPluginBuildLockGeneration(generationDir) === generation;
}

function inspectLegacyPluginBuildLock(
  lockDir: string,
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

  // Old builders treated owner publication as best effort and could continue
  // working without that file. Directory age cannot prove their task ended.
  return {
    state: "active",
    owner: `legacy lock with unconfirmed ${PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE}`,
    fence: legacy.fence,
  };
}

function captureLegacyPluginBuildLockFence(
  lockDir: string,
): PluginBuildLockProtocol.LegacyPluginBuildLockFence | null {
  if (PluginBuildLockProtocol.isPluginBuildLockProtocolV3(lockDir)) {
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
        if (isContendedCandidateRename(error)) {
          captured =
            PluginBuildLockProtocol.readLegacyPluginBuildLockFence(fenceDir);
          // The fence lives inside the legacy lock, so a fence another
          // process recorded and that is gone by now went with a lock that
          // was released or retired meanwhile.
          if (captured === null && !fs.existsSync(fenceDir)) return null;
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
  // publication; v3 ownership is kept in the orthogonal sibling directory.
  const confirmed =
    PluginBuildLockProtocol.readLegacyPluginBuildLockFence(fenceDir);
  if (
    PluginBuildLockProtocol.isPluginBuildLockProtocolV3(lockDir) ||
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
 * Whether a path lookup proves absence. Permission and sharing failures are
 * inconclusive, never evidence of a released or old abandoned generation.
 */
function pluginBuildLockPathMissing(lockDir: string): boolean {
  try {
    fs.statSync(lockDir);
    return false;
  } catch (error) {
    return PluginBuildLockProtocol.isMissingPathError(error);
  }
}
