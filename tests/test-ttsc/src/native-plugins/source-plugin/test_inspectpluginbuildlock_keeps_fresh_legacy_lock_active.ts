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
 * Negative twin of both the `released` and the abandoned-legacy classifications
 * in `buildSourcePlugin.ts::inspectPluginBuildLock`. A lock directory that
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

    const observation = inspectPluginBuildLock(lockDir, Date.now());

    assert.deepEqual(observation, {
      state: "active",
      owner: "legacy lock with no owner.json",
    });
  };
