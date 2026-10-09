import fs from "node:fs";

import { OwnedSynchronousProcess } from "../../../internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../../internal/SourceNativeRetirement";
import type { PluginBinaryWaitResult } from "./PluginBinaryWaitResult";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";
import { formatDuration } from "./formatDuration";
import { inspectPluginBuildLock } from "./inspectPluginBuildLock";

/**
 * Poll for binary pathname publication using a monotonic admission budget.
 * `timeoutMs` is checked between observations, not a hard wall-clock limit: the
 * synchronous inspector can retry internally and native calls can block.
 *
 * Pending native guards suppress binary adoption while the existing bounded
 * wait continues. Unknown or malformed guards refuse immediately. A timeout
 * includes retained paths and never converts pending into reclaimable state.
 *
 * Normal release requests reacquisition and an abandoned owner carries the
 * exact observed generation. Expiring the monotonic wait budget throws; it
 * never retires a live or inconclusive owner while its payload task may still
 * run. An opted-in synchronous owner can cancel observation or interrupt a
 * polling sleep; cancellation never retires the holder's generation.
 *
 * @evidence contracts/common.md#principled-implementation Polling first refuses unknown/malformed native guards, suppresses publication while pending and rechecks after observed release; actual abandoned-owner observations retain their exact generation, while budget expiry fails without revoking a possibly active payload task.
 * @evidence contracts/common.md#clear-and-simple-design The loop separates publication, release, retirement and periodic status reporting; generation interpretation belongs to inspectPluginBuildLock.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Budget expiry throws instead of retiring a live-looking generation and compensating for concurrent callbacks; status output never substitutes for ownership evidence.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe monotonic wait units, distinct results and timeout failure without retirement; owner-aware diagnostics identify the actual contended key.
 * @evidence contracts/portability.md#os-neutral-implementation Node filesystem existence and the shared lock inspector implement native observations; waiting uses platform-neutral shared-memory sleep.
 * @evidence contracts/performance.md#efficient-algorithms Each outer iteration scans native guard metadata, observes an unprotected binary pathname and delegates lock inspection, including its native path/record bytes, observer registration and possible internal retries. Sleeps separate active polls; diagnostic formatting/output is throttled independently and scales with supplied labels/paths. A clock sample taken before inspection is not a hard bound on its duration.
 * @evidence contracts/performance.md#reuse-equivalent-work After pending guards retire, the waiter adopts the same already-published binary instead of compiling the key again; only an observed released generation triggers ordinary reacquisition.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Scoped cancellation ends this waiter without retiring the builder. Its inspector may register observer records retained until process absence is proven, with growth by distinct generations. Returned outcomes, cancellation checkpoints or observed budget expiry end the outer wait; internal inspection/native calls can delay that boundary without an overall deadline. No asynchronous timer is installed.
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
  const startedAt = performance.now();
  let nextStatusAt = startedAt + PLUGIN_BUILD_LOCK_STATUS_MS;
  const protocolDir = PluginBuildLockProtocol.pluginBuildLockProtocolDir(
    opts.lockDir,
  );
  for (;;) {
    OwnedSynchronousProcess.checkpoint();
    SourceNativeRetirement.assertAvailable(protocolDir);
    const protectedNativeInputs =
      SourceNativeRetirement.isProtected(protocolDir);
    if (!protectedNativeInputs && fs.existsSync(opts.binaryPath)) {
      OwnedSynchronousProcess.checkpoint();
      return { outcome: "published" };
    }
    const clock = performance.now();
    const lock = inspectPluginBuildLock(opts.lockDir);
    OwnedSynchronousProcess.checkpoint();
    if (lock.state === "released") {
      // The holder retired its generation between the binary check above and
      // this observation. That is a normal release, not abandonment: prefer the
      // binary when it landed inside that window, otherwise hand the free key
      // back to the caller.
      return !protectedNativeInputs && fs.existsSync(opts.binaryPath)
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
    if (clock - startedAt >= opts.timeoutMs) {
      throw new Error(
        `ttsc: timed out after ${formatDuration(clock - startedAt)} waiting for ` +
          `${opts.lockInfo.label} "${opts.lockInfo.pluginName}" at ${opts.lockDir}; ` +
          `${lock.owner} may still be running; ` +
          `${SourceNativeRetirement.describeProtection(protocolDir) ?? "native ownership has no additional guard"}`,
      );
    }
    if (!opts.lockInfo.quiet && clock >= nextStatusAt) {
      reportPluginLockWait({
        binaryPath: opts.binaryPath,
        elapsedMs: clock - startedAt,
        lockDir: opts.lockDir,
        lockInfo: opts.lockInfo,
        owner: lock.owner,
      });
      nextStatusAt = clock + PLUGIN_BUILD_LOCK_STATUS_MS;
    }
    OwnedSynchronousProcess.sleep(
      Math.min(
        PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_POLL_MS,
        Math.max(0, opts.timeoutMs - (performance.now() - startedAt)),
      ),
    );
  }
}

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
