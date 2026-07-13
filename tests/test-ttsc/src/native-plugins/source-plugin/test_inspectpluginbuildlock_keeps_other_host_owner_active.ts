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
 * Verifies inspectPluginBuildLock keeps an owner from another host active.
 *
 * Negative twin of the dead-owner abandonment along the hostname axis: pid
 * liveness can only be probed on the local machine, so a lock owned by a
 * different host must stay `active` even when that pid happens to be dead
 * locally (a shared cache on a network filesystem). Only the wait budget may
 * end that wait.
 *
 * 1. Take a locally dead pid from a completed child process.
 * 2. Write a lock directory whose `owner.json` names that pid on a hostname that
 *    is not this machine's.
 * 3. Assert inspection reports `active`, not `abandoned`.
 */
export const test_inspectpluginbuildlock_keeps_other_host_owner_active = () => {
  const root = TestProject.tmpdir("ttsc-lock-observe-");
  const lockDir = path.join(root, "entry.lock");
  fs.mkdirSync(lockDir);
  const exited = child_process.spawnSync(process.execPath, ["-e", ""], {
    windowsHide: true,
  });
  assert.equal(exited.status, 0);
  fs.writeFileSync(
    path.join(lockDir, "owner.json"),
    `${JSON.stringify({
      hostname: `${os.hostname()}-elsewhere`,
      pid: exited.pid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );

  const observation = inspectPluginBuildLock(lockDir, Date.now());

  assert.equal(observation.state, "active");
  const owner = observation.state === "active" ? observation.owner : "";
  assert.match(owner, /-elsewhere/);
};
