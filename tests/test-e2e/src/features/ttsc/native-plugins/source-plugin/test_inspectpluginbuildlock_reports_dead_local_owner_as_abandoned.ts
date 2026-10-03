import { TestProject } from "@ttsc/testing";

import {
  assert,
  child_process,
  fs,
  inspectPluginBuildLock,
  os,
  path,
} from "../../../../internal/ttsc/internal/source-build";

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
 * @evidence contracts/testing.md#independent-expectations Actual setup child error/signal/status and positive safe PID precede an independent native ESRCH check. Explicit hostname/record and literal abandoned/PID-specific reason prescribe the owning inspector result; no age or arbitrary error substitutes for absence.
 * @evidence contracts/testing.md#distinguishing-cases Actual same-host absence is this positive control; the exact direct counterpart also authors a live-PID contrast but is UNEXECUTED. Remote/ambiguous controls require their separate owner evidence. Numeric PID reuse remains an acknowledged limitation.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named generic entry, which directly calls the built workspace owning inspector. Real child/filesystem inputs do not by themselves make it an installed-consumer/native-producer protocol test.
 * @evidenceExclude contracts/e2e.md#necessary-boundary Direct inspector ownership with actual native PID/record inputs is unit-first; it requires no installed artifact, plugin host or product protocol. Exact counterpart is tests/test-ttsc/src/features/source-plugin/test_inspectpluginbuildlock_reports_dead_local_owner_as_abandoned.ts, authored but not actually executed.
 * @evidence contracts/e2e.md#shared-execution Existing one-child/one-record/one-inspection preparation remains only until exact direct counterpart selection/execution/survival permits duplicate-call removal. This is not a claimed E2E family preparation or Go build/process reduction.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before setup; native child success/ESRCH precede owner recording. Inspector returns before any further mutation. A later PID reuse remains possible and startedAt does not certify incarnation; root retention is not arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Original child status0, local record, abandoned state and exact PID reason remain alongside strengthened setup guards. The exact authored direct counterpart preserves these native inputs rather than synthetic absence; actual selection/runtime/survival remains unverified and donor stays.
 */
export const test_inspectpluginbuildlock_reports_dead_local_owner_as_abandoned =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-observe-");
    TestProject.retainTemporaryDirectory(root, "direct inspector native setup has no descendant join acknowledgement");
    const lockDir = path.join(root, "entry.lock");
    fs.mkdirSync(lockDir);
    const exited = child_process.spawnSync(process.execPath, ["-e", ""], {
      windowsHide: true,
    });
    assert.equal(exited.error, undefined, "inspector setup child launch error");
    assert.equal(exited.signal, null, "inspector setup child terminated by signal");
    assert.equal(exited.status, 0);
    assert.ok(Number.isSafeInteger(exited.pid) && exited.pid > 0, "inspector setup requires a positive safe PID");
    let absence: unknown;
    try { process.kill(exited.pid, 0); }
    catch (error) { absence = error; }
    assert.equal((absence as NodeJS.ErrnoException | undefined)?.code, "ESRCH", "only ESRCH proves the recorded PID absent");
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
