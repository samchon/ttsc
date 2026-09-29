import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  path,
} from "../../internal/source-build";

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
