import fs from "node:fs";

import type { PluginBinaryWaitResult } from "./PluginBinaryWaitResult";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";
import { formatDuration } from "./formatDuration";
import { inspectPluginBuildLock } from "./inspectPluginBuildLock";

/**
 * Poll for the locked builder to publish its binary, up to `timeoutMs`.
 *
 * Exported for unit tests.
 */
export function waitForPluginBinary(opts: {
  binaryPath: string;
  lockDir: string;
  lockInfo: {
    label: string;
    pluginName: string;
    quiet: boolean;
  };
  timeoutMs: number;
}): PluginBinaryWaitResult {
  const startedAt = Date.now();
  let nextStatusAt = startedAt + PLUGIN_BUILD_LOCK_STATUS_MS;
  for (;;) {
    if (fs.existsSync(opts.binaryPath)) {
      return { outcome: "published" };
    }
    const now = Date.now();
    const lock = inspectPluginBuildLock(opts.lockDir, now);
    if (lock.state === "released") {
      // The holder retired its generation between the binary check above and
      // this observation. That is a normal release, not abandonment: prefer the
      // binary when it landed inside that window, otherwise hand the free key
      // back to the caller.
      return fs.existsSync(opts.binaryPath)
        ? { outcome: "published" }
        : { outcome: "released" };
    }
    if (lock.state === "abandoned") {
      return {
        outcome: "abandoned",
        reason: lock.reason,
        fence: lock.fence,
      };
    }
    if (now - startedAt > opts.timeoutMs) {
      return {
        outcome: "abandoned",
        reason: `timed out after ${formatDuration(now - startedAt)}`,
        fence: lock.fence,
      };
    }
    if (!opts.lockInfo.quiet && now >= nextStatusAt) {
      reportPluginLockWait({
        binaryPath: opts.binaryPath,
        elapsedMs: now - startedAt,
        lockDir: opts.lockDir,
        lockInfo: opts.lockInfo,
        owner: lock.owner,
      });
      nextStatusAt = now + PLUGIN_BUILD_LOCK_STATUS_MS;
    }
    PluginBuildLockProtocol.sleepSync(PLUGIN_BUILD_LOCK_POLL_MS);
  }
}

const PLUGIN_BUILD_LOCK_POLL_MS = 50;

const PLUGIN_BUILD_LOCK_STATUS_MS = 30_000;

function reportPluginLockWait(opts: {
  binaryPath: string;
  elapsedMs: number;
  lockDir: string;
  lockInfo: {
    label: string;
    pluginName: string;
    quiet: boolean;
  };
  owner: string;
}): void {
  process.stderr.write(
    `ttsc: waiting for ${opts.lockInfo.label} "${opts.lockInfo.pluginName}" ` +
      `cache lock after ${formatDuration(opts.elapsedMs)}; ` +
      `lock=${opts.lockDir}; binary=${opts.binaryPath}; owner=${opts.owner}\n`,
  );
}
