import { TestProject } from "@ttsc/testing";

import {
  assert,
  child_process,
  fs,
  inspectPluginBuildLock,
  os,
  path,
} from "../../internal/source-build";

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

    const observation = inspectPluginBuildLock(lockDir, Date.now());

    assert.equal(observation.state, "abandoned");
    const reason = observation.state === "abandoned" ? observation.reason : "";
    assert.match(
      reason,
      new RegExp(`pid ${deadPid} on .+ is no longer running`),
    );
  };
