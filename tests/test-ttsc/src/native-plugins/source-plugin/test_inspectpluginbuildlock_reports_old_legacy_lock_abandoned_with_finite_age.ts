import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  path,
} from "../../internal/source-build";

/**
 * Verifies inspectPluginBuildLock reports an old legacy lock as abandoned with
 * a finite age.
 *
 * Keeps the #341 stale-lock guarantee intact under the #421 rework: a lock
 * directory that still exists, has no `owner.json`, and is older than the
 * legacy staleness window must remain reclaimable, and its diagnostic must
 * carry the real measured age — the `Infinitym NaNs` spelling belonged to the
 * misclassified released lock, never to this branch.
 *
 * 1. Create a metadata-less lock directory and backdate its mtime by two minutes.
 * 2. Inspect it.
 * 3. Assert the state is `abandoned` and the reason names the legacy lock with a
 *    finite `Nm Ns old` age containing no `Infinity`/`NaN` token.
 */
export const test_inspectpluginbuildlock_reports_old_legacy_lock_abandoned_with_finite_age =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-observe-");
    const lockDir = path.join(root, "entry.lock");
    fs.mkdirSync(lockDir);
    const old = new Date(Date.now() - 120_000);
    fs.utimesSync(lockDir, old, old);

    const observation = inspectPluginBuildLock(lockDir, Date.now());

    assert.equal(observation.state, "abandoned");
    const reason = observation.state === "abandoned" ? observation.reason : "";
    assert.match(reason, /legacy lock has no owner\.json and is \dm \d+s old/);
    assert.doesNotMatch(reason, /Infinity|NaN/);
  };
