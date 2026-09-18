import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { PluginBuildLockLease } from "./PluginBuildLockLease";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * Atomically acquire the current generation in a v2 coordination directory.
 *
 * A non-empty candidate is renamed to `current`. Directory rename cannot
 * replace a non-empty `current`, so exactly one contender wins without an
 * empty-owner publication window. `null` means either another v2 holder won or
 * the path is a legacy lock that must be observed before it can be reclaimed.
 *
 * Exported for deterministic multi-process tests.
 */
export function acquirePluginBuildLock(
  lockDir: string,
): PluginBuildLockLease | null {
  // A legacy holder owns the old path. Never publish v2 ownership into that
  // deletable namespace; wait until the legacy generation is released or
  // reclaimed, then use the orthogonal persistent v2 directory.
  if (pluginBuildLockPathExists(lockDir)) {
    return null;
  }
  const protocolDir =
    PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir);
  ensurePluginBuildLockProtocol(protocolDir);
  // Close the initialization window as far as the legacy protocol permits. A
  // legacy holder that appeared while v2 was initialized still blocks this
  // acquisition. (A legacy executable cannot provide a true cross-path CAS.)
  if (pluginBuildLockPathExists(lockDir)) {
    return null;
  }

  const generation = crypto.randomBytes(16).toString("hex");
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
    writePluginBuildLockOwner(candidateDir, generation);
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
        PluginBuildLockProtocol.isRenameDestinationOccupied(
          error,
          path.join(
            protocolDir,
            PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_CURRENT_DIR,
          ),
        )
      ) {
        return null;
      }
      throw error;
    }
    return { protocol: "v2", generation };
  } finally {
    // The candidate name contains this process's random generation and can
    // never alias `current` or another contender's candidate.
    fs.rmSync(candidateDir, { force: true, recursive: true });
  }
}

function ensurePluginBuildLockProtocol(protocolDir: string): void {
  if (PluginBuildLockProtocol.isPluginBuildLockProtocolV2(protocolDir)) {
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
        PluginBuildLockProtocol.isPluginBuildLockProtocolV2(protocolDir)
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
): void {
  fs.writeFileSync(
    path.join(
      generationDir,
      PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE,
    ),
    `${JSON.stringify(
      {
        generation,
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
