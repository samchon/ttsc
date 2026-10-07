import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { PluginBuildLockLease } from "./PluginBuildLockLease";
import { PluginBuildLockOwner } from "./PluginBuildLockOwner";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * Retire a held v3 generation during the holder's finally. False means the
 * generation already retired or disappeared; unexpected filesystem errors
 * propagate to the caller's release reporting boundary.
 * Ordinary synchronous contention retains its existing retries. Scoped
 * cancellation uses the shared retirement helper's cleanup grace and reports
 * a continuing refusal as ownership failure to the opted-in request owner.
 *
 * Call only after the held payload callback has ended. Release records that
 * completion in this exact retired generation, even if a waiter retired it
 * first. A timeout or lease transfer alone does not satisfy this precondition.
 * Unconfirmed metadata or failed publication leaves task completion unproven,
 * so cache maintenance conservatively protects the payload while its owner may
 * still act.
 *
 * @evidence contracts/common.md#principled-implementation The lease's generation selects its reserved tombstone; only a matching generation file, owner identity and completion nonce permit atomic completion publication after the actual payload callback ends.
 * @evidence contracts/common.md#clear-and-simple-design Release delegates retirement and owns exact-generation completion publication; callers own actual callback completion, finally scheduling and error reporting.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Release renames the leased generation into retained history rather than recursively deleting a possibly replaced current directory.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain return/error behavior and the actual-task-end precondition, distinguishing completion publication from timeout or lease transfer before the tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native path construction and the shared rename adapter preserve the same retirement meaning across Windows sharing refusals and POSIX contention.
 * @evidence contracts/performance.md#efficient-algorithms Direct retirement/completion paths avoid owner-population scans; costs include native path construction, owner JSON/hostname and generation bytes plus marker publication. Eligible Windows refusals repeat synchronous waits and sibling probes after a sampled sibling rename succeeds; ordinary work has no deadline, while scoped cancelled retries use the shared helper's one-second between-attempt grace. Native calls and yields are not hard bounded, and the probe does not establish the original refusal's cause.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Release is an effectful ownership transition, so a previous result cannot authorize a later call to skip its own atomic retirement attempt.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Qualified callback completion permits payload eviction; pending marker files have finally-based removal that can fail. Ordinary retirement retries can block indefinitely; scoped cancelled cleanup stops retry admission after its shared grace and records actual refusal for the opted-in owner, without bounding native calls or yields. Best-effort probe cleanup may leave empty siblings. Cooperating collectors retain tombstones until recorded holder/observer absence; unconfirmed completion protects payloads while their owners may still act.
 */
export function releasePluginBuildLock(
  lockDir: string,
  lease: PluginBuildLockLease,
): boolean {
  if (lease.protocol !== "v3") return false;
  const protocolDir =
    PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir);
  const retired = PluginBuildLockProtocol.retireV3PluginBuildLock(
    protocolDir,
    lease.generation,
  );
  recordPluginBuildLockTaskCompletion(protocolDir, lease);
  return retired;
}

/**
 * Publish only into the qualified retired generation. This process remains
 * alive throughout publication, so observer-aware collection cannot remove it.
 */
function recordPluginBuildLockTaskCompletion(
  protocolDir: string,
  lease: PluginBuildLockLease,
): void {
  if (
    !PluginBuildLockProtocol.isPluginBuildLockGeneration(lease.generation) ||
    !PluginBuildLockProtocol.isPluginBuildLockGeneration(lease.completionNonce)
  ) {
    return;
  }
  const generationDir = path.join(
    protocolDir,
    PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_RETIRED_DIR,
    lease.generation,
  );
  const owner = PluginBuildLockOwner.read(generationDir);
  if (
    owner === null ||
    owner.generation !== lease.generation ||
    owner.completionNonce !== lease.completionNonce ||
    owner.pid !== process.pid ||
    owner.hostname.toLowerCase() !== os.hostname().toLowerCase()
  ) {
    return;
  }
  try {
    if (
      fs
        .readFileSync(
          path.join(
            generationDir,
            PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_GENERATION_FILE,
          ),
          "utf8",
        )
        .trim() !== lease.generation
    ) {
      return;
    }
  } catch {
    return;
  }
  const marker = path.join(
    generationDir,
    PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_COMPLETION_FILE,
  );
  const candidate = `${marker}.pending-${crypto.randomBytes(16).toString("hex")}`;
  try {
    fs.writeFileSync(candidate, `${lease.completionNonce}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    fs.renameSync(candidate, marker);
  } finally {
    fs.rmSync(candidate, { force: true });
  }
}
