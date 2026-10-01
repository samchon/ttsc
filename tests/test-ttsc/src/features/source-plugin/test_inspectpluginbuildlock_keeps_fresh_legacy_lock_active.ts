import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  path,
} from "../../internal/source-build-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Retains a freshly created metadata-less lock as an active legacy generation fence.
 * @evidence contracts/testing.md#independent-expectations Initial directory acquisition precedes owner publication; literal active/legacy labels and 32-hex generation follow that protocol.
 * @evidence contracts/testing.md#distinguishing-cases Pins missing metadata during acquisition; absence, old age and corrupt metadata have distinct sibling units.
 * @evidence contracts/testing.md#execution-ownership test_inspectpluginbuildlock_keeps_fresh_legacy_lock_active is discovered once under src/features/source-plugin and directly invokes the authored lock/cache operation over test-owned paths. This case installs no consumer, builds no artifact and starts no product host; the temporary-directory owner and its explicit lease finally blocks release its state.
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
