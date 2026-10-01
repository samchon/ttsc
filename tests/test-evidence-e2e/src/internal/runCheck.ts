import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import path from "node:path";

import type { IRunResult } from "../../../utils/src/evidence/IRunResult";
import { EvidenceProcessOwnership } from "../../../utils/src/evidence/EvidenceProcessOwnership";
import { pluginCacheDirectory } from "../../../utils/src/evidence/pluginCacheDirectory";
import { resolveDependency } from "../../../utils/src/evidence/resolveDependency";

/**
 * Runs `ttsc check` in the fixture and captures everything it said.
 *
 * The launcher script is invoked through `node` rather than through a shim on
 * PATH. `ttsc` publishes `bin: {"ttsc": "lib/launcher/ttsc.js"}` and has no
 * `bin/` directory, so probing for one and falling back to a bare `"ttsc"` only
 * works when something else — `npm run`, which injects `node_modules/.bin` —
 * happens to have prepared PATH. That made the suite pass for a reason it did
 * not state, and fail the moment it was driven any other way.
 *
 * A null status or signal leaves descendant closure unknown. The original
 * result remains available to assertions, while shared inputs are retained
 * and fixture cleanup or another command refuses that unresolved identity.
 *
 * @evidence contracts/common.md#principled-implementation Invokes the resolved published launcher with actual cwd/options and returns its status and complete captured streams; unknown signal/null closure records a blocking input lifetime without fabricating a compiler verdict.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous command boundary owns capture and forwards unresolved-reader state to the fixture ownership registry; callers retain their original assertions and cleanup policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The command uses no PATH fallback, fake producer or rewritten diagnostic. A killed launcher cannot authorize deletion of inputs that its descendants may still read.
 * @evidence contracts/common.md#meaningful-documentation Explains the published launcher location, real consumer invocation and unknown descendant retention while preserving the original command result.
 * @evidence contracts/portability.md#os-neutral-implementation Node executable plus argv and native cwd avoid shell or executable-shim assumptions; null/signal termination has the same unknown-input consequence across platforms.
 * @evidence contracts/performance.md#efficient-algorithms One spawn captures streams up to the explicit buffer budget; output assembly scales with captured bytes and does not parse or recompute diagnostics.
 * @evidence contracts/performance.md#reuse-equivalent-work The existing suite cache is shared by actual commands under production cache validation. Each changed consumer still runs its real check, and unknown input ownership blocks subsequent command reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous spawn owns its timeout and capture buffers. Normal command status remains observable; a signal or null status retains fixture and existing shared inputs through their owners because launcher termination cannot establish descendant release.
 */
export const runCheck = (directory: string): IRunResult => {
  EvidenceProcessOwnership.assertAvailable(directory);
  const launcher: string = path.join(
    resolveDependency("ttsc"),
    "lib",
    "launcher",
    "ttsc.js",
  );
  const result: SpawnSyncReturns<string> = spawnSync(
    process.execPath,
    [launcher, "check", "-p", "tsconfig.json"],
    {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, TTSC_CACHE_DIR: pluginCacheDirectory(directory) },
      // Generous because the FIRST run of a cache key statically links this
      // package's Go into the lint binary, which ttsc itself warns "can take
      // several minutes on a cold Go cache" — measured at ~9 minutes here.
      timeout: 900_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const stdout: string = result.stdout ?? "";
  const stderr: string = result.stderr ?? "";
  if (result.status === null || result.signal !== null)
    EvidenceProcessOwnership.retain(directory, new Error(
      "The CLI launcher did not establish descendant closure.",
      { cause: result.error ?? result.signal },
    ));
  return {
    status: result.status,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
  };
};
