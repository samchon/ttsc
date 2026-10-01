import { TestProject } from "@ttsc/testing";

import {
  assert,
  child_process,
  fs,
  inspectPluginBuildLock,
  os,
  path,
} from "../../../internal/source-build";

/**
 * Verifies inspectPluginBuildLock reports a dead same-host owner as abandoned.
 *
 * Keeps the #341 dead-owner guarantee intact under the #421 rework: a lock
 * whose `owner.json` names a same-host pid that is no longer running will never
 * be released, so waiters must be allowed to steal it instead of stalling for
 * the full wait budget.
 *
 * 1. Run a short-lived child process to completion and take its now-dead pid.
 * 2. Write a lock directory whose `owner.json` names that pid on this host.
 * 3. Assert inspection reports `abandoned` with a "no longer running" reason.
 *
 * @evidence contracts/testing.md#behavioral-verification Shipped inspection must classify a completed same-host child owner as abandoned and report that exact PID as no longer running.
 * @evidence contracts/testing.md#independent-expectations Synchronous child exit status establishes the native completed-process premise, and the explicitly recorded local hostname scopes its PID; the literal abandoned state and PID-specific reason specify the expected proof.
 * @evidence contracts/testing.md#distinguishing-cases Confirmed same-host absence is the positive abandonment control; the remote-host active case and live/ambiguous owner units own its negative authority distinctions. PID reuse remains a limitation of numeric process identity.
 * @evidence contracts/testing.md#execution-ownership The exported entry observes an actually completed Node child through the shipped legacy lock inspector and its native signal-zero ownership path.
 * @evidence contracts/e2e.md#necessary-boundary The connection between a recorded local PID and real native absence is required here; a supplied absent-PID decision would only prove policy, not this process observation.
 * @evidence contracts/e2e.md#shared-execution One short-lived child, one private owner record and one inspection establish the native absence connection without Go compilation, a plugin host or separate installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The child is synchronously complete before its PID is recorded and the legacy lock is private. A later PID reuse can make absence inconclusive; the test does not claim startedAt proves process incarnation.
 * @evidence contracts/e2e.md#preserved-coverage The original child success, abandoned state and exact PID reason assertions remain; no stale age or invalid PID constant substitutes for the exited child witness.
 */
export const test_inspectpluginbuildlock_reports_dead_local_owner_as_abandoned =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-observe-");
    const lockDir = path.join(root, "entry.lock");
    fs.mkdirSync(lockDir);
    const exited = child_process.spawnSync(process.execPath, ["-e", ""], {
      windowsHide: true,
    });
    assert.equal(exited.status, 0);
    const deadPid = exited.pid;
    fs.writeFileSync(
      path.join(lockDir, "owner.json"),
      `${JSON.stringify({
        hostname: os.hostname(),
        pid: deadPid,
        startedAt: new Date().toISOString(),
      })}\n`,
      "utf8",
    );

    const observation = inspectPluginBuildLock(lockDir);

    assert.equal(observation.state, "abandoned");
    const reason = observation.state === "abandoned" ? observation.reason : "";
    assert.match(
      reason,
      new RegExp(`pid ${deadPid} on .+ is no longer running`),
    );
  };
