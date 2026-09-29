import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isContendedCandidateRename } from "../../../internal/isContendedCandidateRename";
import type { PluginBuildLockLease } from "./PluginBuildLockLease";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * Atomically acquire the current generation in a v3 coordination directory.
 *
 * A non-empty candidate is renamed to `current`. Directory rename cannot
 * replace a non-empty `current`, so exactly one contender wins without an
 * empty-owner publication window. `null` means either another v3 holder won or
 * the path is a legacy lock that must be observed before it can be reclaimed.
 *
 * The caller releases the returned lease in finally after its actual payload
 * callback ends. Its independent completion nonce qualifies that task's marker.
 * The persistent protocol root and retired identities outlive the binary cache
 * entry. Old v2 clients use another namespace and do not share this version's
 * build serialization. Legacy clients also cannot provide a cross-path
 * compare-and-swap.
 *
 * @evidence contracts/common.md#principled-implementation Publishing a complete nonempty candidate by directory rename gives one v3 contender ownership; another nonempty current cannot be replaced by that rename.
 * @evidence contracts/common.md#clear-and-simple-design Acquisition owns complete metadata publication and candidate cleanup; the caller owns building and finally release through the returned lease.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A lost publication race returns null; it never force-removes a holder or substitutes uncoordinated success for failed acquisition.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain atomic publication, null, lease cleanup and the actual older-version serialization limits before the tags.
 * @evidence contracts/portability.md#os-neutral-implementation Node paths and directory operations preserve native naming, reject symlink legacy lock paths and distinguish rename contention through the platform error adapter.
 * @evidence contracts/performance.md#efficient-algorithms Acquisition performs a fixed number of metadata operations and writes bounded owner records; it does not scan sibling generations or enumerate processes.
 * @evidence contracts/performance.md#reuse-equivalent-work A cache-key lock selects one producer among v3 consumers; binary identity and under-lock publication rechecking remain the build caller's responsibility, not assumptions made by a matching lock path.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One candidate belongs to this attempt and is removed in finally; a winning lease transfers generation ownership to the caller, while persistent roots remain per historical cache key to preserve fencing.
 */
export function acquirePluginBuildLock(
  lockDir: string,
): PluginBuildLockLease | null {
  // A legacy holder owns the old path. Never publish v3 ownership into that
  // deletable namespace; wait until the legacy generation is released or
  // reclaimed, then use the orthogonal persistent v3 directory.
  if (pluginBuildLockPathExists(lockDir)) {
    return null;
  }
  const protocolDir =
    PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir);
  ensurePluginBuildLockProtocol(protocolDir);
  // Close the initialization window as far as the legacy protocol permits. A
  // legacy holder that appeared while v3 was initialized still blocks this
  // acquisition. (A legacy executable cannot provide a true cross-path CAS.)
  if (pluginBuildLockPathExists(lockDir)) {
    return null;
  }

  const generation = crypto.randomBytes(16).toString("hex");
  const completionNonce = crypto.randomBytes(16).toString("hex");
  const candidateDir = path.join(protocolDir, `candidate-${generation}`);
  fs.mkdirSync(candidateDir);
  try {
    fs.writeFileSync(
      path.join(
        candidateDir,
        PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_GENERATION_FILE,
      ),
      `${generation}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    writePluginBuildLockOwner(candidateDir, generation, completionNonce);
    try {
      fs.renameSync(
        candidateDir,
        path.join(
          protocolDir,
          PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_CURRENT_DIR,
        ),
      );
    } catch (error) {
      if (
        PluginBuildLockProtocol.isMissingPathError(error) ||
        isContendedCandidateRename(error)
      ) {
        return null;
      }
      throw error;
    }
    return { protocol: "v3", generation, completionNonce };
  } finally {
    // The candidate name contains this process's random generation and can
    // never alias `current` or another contender's candidate.
    fs.rmSync(candidateDir, { force: true, recursive: true });
  }
}

function ensurePluginBuildLockProtocol(protocolDir: string): void {
  if (PluginBuildLockProtocol.isPluginBuildLockProtocolV3(protocolDir)) {
    return;
  }

  const generation = crypto.randomBytes(16).toString("hex");
  const candidateDir = `${protocolDir}.candidate-${generation}`;
  fs.mkdirSync(candidateDir);
  try {
    fs.mkdirSync(
      path.join(
        candidateDir,
        PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_RETIRED_DIR,
      ),
    );
    fs.writeFileSync(
      path.join(
        candidateDir,
        PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_PROTOCOL_FILE,
      ),
      PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_PROTOCOL,
      { encoding: "utf8", flag: "wx" },
    );
    try {
      fs.renameSync(candidateDir, protocolDir);
    } catch (error) {
      if (
        PluginBuildLockProtocol.isRenameDestinationOccupied(
          error,
          protocolDir,
        ) &&
        PluginBuildLockProtocol.isPluginBuildLockProtocolV3(protocolDir)
      ) {
        return;
      }
      throw error;
    }
  } finally {
    fs.rmSync(candidateDir, { force: true, recursive: true });
  }
}

function writePluginBuildLockOwner(
  generationDir: string,
  generation: string,
  completionNonce: string,
): void {
  fs.writeFileSync(
    path.join(
      generationDir,
      PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE,
    ),
    `${JSON.stringify(
      {
        generation,
        completionNonce,
        hostname: os.hostname(),
        pid: process.pid,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function pluginBuildLockPathExists(lockDir: string): boolean {
  try {
    const stats = fs.lstatSync(lockDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`ttsc: unsafe plugin build lock path: ${lockDir}`);
    }
    return true;
  } catch (error) {
    if (PluginBuildLockProtocol.isMissingPathError(error)) return false;
    throw error;
  }
}
