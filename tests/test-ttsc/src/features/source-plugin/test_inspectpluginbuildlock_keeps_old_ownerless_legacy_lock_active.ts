import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  path,
} from "../../internal/source-build-unit";

/**
 * Verifies age alone cannot make an ownerless legacy lock reclaimable.
 *
 * An old builder can still work after its best-effort owner publication failed.
 * A two-minute mtime is not proof that its task has ended, so inspection must
 * retain its fence without offering abandonment authority.
 *
 * 1. Create a metadata-less lock directory and backdate its mtime by two minutes.
 * 2. Inspect it.
 * 3. Assert the state stays active with an unconfirmed owner.
 *
 * @evidence contracts/testing.md#behavioral-verification Retains a backdated ownerless directory as an active legacy fence.
 * @evidence contracts/testing.md#independent-expectations An mtime alone cannot prove a task died; literal active state and legacy protocol are independent fail-safe expectations.
 * @evidence contracts/testing.md#distinguishing-cases Changes age by two minutes relative to the fresh-legacy twin while preserving unconfirmed ownership.
 * @evidence contracts/testing.md#execution-ownership test_inspectpluginbuildlock_keeps_old_ownerless_legacy_lock_active is discovered once under src/features/source-plugin and directly invokes the authored lock/cache operation over test-owned paths. This case installs no consumer, builds no artifact and starts no product host; the temporary-directory owner and its explicit lease finally blocks release its state.
 */
export const test_inspectpluginbuildlock_keeps_old_ownerless_legacy_lock_active =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-observe-");
    const lockDir = path.join(root, "entry.lock");
    fs.mkdirSync(lockDir);
    const old = new Date(Date.now() - 120_000);
    fs.utimesSync(lockDir, old, old);

    const observation = inspectPluginBuildLock(lockDir);

    assert.equal(observation.state, "active");
    if (observation.state !== "active") return;
    assert.match(observation.owner, /legacy lock with unconfirmed owner\.json/);
    assert.equal(observation.fence.protocol, "legacy");
  };
