import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  os,
  path,
} from "../../internal/source-build-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Reads owner.json naming this running process and returns active with its pid label.
 * @evidence contracts/testing.md#independent-expectations The authored current pid is independently live; literal active ownership forbids stealing its lock.
 * @evidence contracts/testing.md#distinguishing-cases Only the live same-host owner is run: an owner record naming this process on this host must stay active with a label naming the pid; a dead same-host owner (abandoned) is not exercised here.
 * @evidence contracts/testing.md#execution-ownership A unit test calling inspectPluginBuildLock directly on a legacy-layout lock directory whose owner.json names this process in a private temp directory; it acquires no lease and starts no process, build or host.
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

  const observation = inspectPluginBuildLock(lockDir);

  assert.equal(observation.state, "active");
  const owner = observation.state === "active" ? observation.owner : "";
  assert.match(owner, new RegExp(`pid ${process.pid} on `));
};
