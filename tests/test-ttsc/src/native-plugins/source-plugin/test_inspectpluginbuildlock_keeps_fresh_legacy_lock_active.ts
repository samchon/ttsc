import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  path,
} from "../../internal/source-build";

/**
 * Verifies inspectPluginBuildLock keeps a fresh metadata-less lock active.
 *
 * Negative twin of the `released` classification in
 * `inspectPluginBuildLock.ts::inspectPluginBuildLock`. A lock directory that
 * exists but has no `owner.json` yet is the normal instant between a holder's
 * `mkdir` and its owner write — treating it as released would race waiters into
 * duplicate acquisition, and treating it as abandoned would steal a healthy
 * holder's lock.
 *
 * 1. Create a lock directory with a current mtime and no `owner.json`.
 * 2. Inspect it.
 * 3. Assert the state is `active` with the legacy-lock owner label.
 */
export const test_inspectpluginbuildlock_keeps_fresh_legacy_lock_active =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-observe-");
    const lockDir = path.join(root, "entry.lock");
    fs.mkdirSync(lockDir);

    const observation = inspectPluginBuildLock(lockDir);

    assert.equal(observation.state, "active");
    if (observation.state !== "active") return;
    assert.equal(observation.owner, "legacy lock with unconfirmed owner.json");
    assert.equal(observation.fence.protocol, "legacy");
    assert.match(observation.fence.generation, /^[0-9a-f]{32}$/);
  };
