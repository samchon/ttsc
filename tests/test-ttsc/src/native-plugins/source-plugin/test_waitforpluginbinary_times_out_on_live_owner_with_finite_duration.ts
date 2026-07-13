import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  os,
  path,
  waitForPluginBinary,
} from "../../internal/source-build";

/**
 * Verifies waitForPluginBinary times out on a live owner with a finite
 * duration.
 *
 * Pins the wait-budget escape hatch that survives the #421 rework: a lock held
 * by a live process that never publishes must eventually surface as `abandoned`
 * via the timeout, and the timeout reason must print a real measured duration —
 * the release/abandon distinction may never disable the bound, or a wedged
 * holder would hang every waiter forever.
 *
 * 1. Create a lock owned by this (live) process so inspection stays `active`.
 * 2. Call the wait loop with a zero timeout budget.
 * 3. Assert it returns `abandoned` with a `timed out after <finite>` reason
 *    containing no `Infinity`/`NaN` token.
 */
export const test_waitforpluginbinary_times_out_on_live_owner_with_finite_duration =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-wait-");
    const lockDir = path.join(root, "entry.lock");
    fs.mkdirSync(lockDir);
    fs.writeFileSync(
      path.join(lockDir, "owner.json"),
      `${JSON.stringify({
        hostname: os.hostname(),
        pid: process.pid,
        startedAt: new Date().toISOString(),
      })}\n`,
      "utf8",
    );

    const result = waitForPluginBinary({
      binaryPath: path.join(root, "entry", "plugin.exe"),
      lockDir,
      lockInfo: {
        label: "source plugin",
        pluginName: "wait-test",
        quiet: true,
      },
      timeoutMs: 0,
    });

    assert.equal(result.outcome, "abandoned");
    const reason = result.outcome === "abandoned" ? result.reason : "";
    // The elapsed poll normally reads ~50ms, but a loaded CI runner can stall
    // past the 1s/1m formatting boundaries, so accept any finite rendering.
    assert.match(reason, /^timed out after (\d+ms|\d+s|\d+m \d+s)$/);
    assert.doesNotMatch(reason, /Infinity|NaN/);
  };
