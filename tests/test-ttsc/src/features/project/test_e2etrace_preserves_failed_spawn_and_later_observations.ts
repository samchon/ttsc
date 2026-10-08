import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";

/**
 * Verifies absent spawn output preserves failure and later trace observations.
 *
 * An isolated source actor owns the private tracer's process-global sink. Real
 * failed attempts and subsequent children share that actor, so recovery cannot
 * accidentally succeed by replacing the failed writer.
 *
 * 1. Observe missing cwd and executable attempts followed by successful calls.
 * 2. Preserve null, text, buffer, empty and nonzero returned output semantics.
 * 3. Cause a real payload write failure and verify tracing remains closed.
 *
 * @evidence contracts/testing.md#behavioral-verification The actor calls actual E2ETrace.synchronous/begin/result with native spawnSync envelopes. It checks same-object return, matching native failure metadata, continued later observations and exact payload values. A directory at the writer-owned payload path proves real IO errors still retain integrity failure and disable later observations while commands succeed.
 * @evidence contracts/testing.md#independent-expectations Native spawnSync supplies independent PID/status/signal/error/output observations. Literal missing-input ENOENT, child output out/err, exit code7, ignored streams and empty output distinguish outcomes without reconstructing tracer internals. The actual attempt identity only locates the owned file to obstruct for the IO failure control.
 * @evidence contracts/testing.md#distinguishing-cases Missing cwd and missing executable must retain failure results and same-actor recovery; ignored streams remain absent while returned text, bytes and empty buffers retain their values. Nonzero child exit stays distinct from spawn failure. Genuine payload IO failure intentionally remains fail-closed rather than receiving the recovery allowed for absent output.
 * @evidence contracts/testing.md#execution-ownership One isolated source unit actor imports the authored private helper through the existing unit loader and runs sequential plain Node primitives. It requires no installation, compiler/native build or product host. Script assertions belong to this named discoverable unit; cleanup follows synchronous actor settlement, and an unconfirmed actor leaves scratch retained.
 */
export function test_e2etrace_preserves_failed_spawn_and_later_observations(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-trace-results-"));
  const trace = path.join(root, "trace");
  fs.mkdirSync(trace);
  const actor = fileURLToPath(new URL("../../internal/e2e-trace-result-actor.ts", import.meta.url));
  const loader = new URL("../../../../../config/register-unit-loader.mjs", import.meta.url).href;
  const result = childProcess.spawnSync(process.execPath, ["--import", loader, actor, root], {
    encoding: "utf8",
    env: SidecarEnvironment.merge(process.env, { NODE_OPTIONS: undefined, TTSC_E2E_TRACE: trace }),
    windowsHide: true,
  });
  const failures: unknown[] = [];
  try {
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(result.stdout) as { failures: unknown[] };
    assert.deepEqual(report.failures, []);
  } catch (error) {
    failures.push(error);
  } finally {
    if (result.error === undefined && result.signal === null && result.status !== null) {
      try { fs.rmSync(root, { recursive: true, force: true }); }
      catch (error) { failures.push(error); }
    }
  }
  if (failures.length) throw new AggregateError(failures, `trace actor failed; scratch ${root}`);
}
