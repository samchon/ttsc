import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies inspectPluginBuildLock keeps a live same-host owner active.
 *
 * Negative twin of the dead-owner abandonment: a lock whose `owner.json` names
 * a pid that is still running is a healthy builder mid-`go build`. Classifying
 * it as abandoned (or released) would steal the lock out from under a live
 * holder and launch a duplicate build of the same cache key.
 *
 * 1. Write a lock directory whose `owner.json` names this test process's own
 *    (definitely live) pid on this host.
 * 2. Inspect it.
 * 3. Assert the state is `active` and the owner label names the pid.
 */
export const test_inspectpluginbuildlock_keeps_live_local_owner_active = () => {
  const root = TestProject.tmpdir("ttsc-lock-observe-");
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

  const observation = inspectPluginBuildLock(lockDir, Date.now());

  assert.equal(observation.state, "active");
  const owner = observation.state === "active" ? observation.owner : "";
  assert.match(owner, new RegExp(`pid ${process.pid} on `));
};
