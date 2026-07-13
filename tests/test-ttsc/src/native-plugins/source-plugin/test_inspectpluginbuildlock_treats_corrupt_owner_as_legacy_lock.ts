import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  inspectPluginBuildLock,
  path,
} from "../../internal/source-build";

/**
 * Verifies inspectPluginBuildLock treats a corrupt owner file as a legacy lock,
 * not a released one.
 *
 * Pins the boundary of the #421 `released` state: `released` requires the lock
 * DIRECTORY to be gone, not merely the owner metadata to be unreadable. A
 * present directory with an unparsable `owner.json` (a torn write, a crash
 * mid-write) must fall back to the age-based legacy classification, so a
 * still-held lock is never handed back to waiters as a free key.
 *
 * 1. Create a lock directory whose `owner.json` contains invalid JSON and backdate
 *    the directory past the legacy staleness window.
 * 2. Inspect it.
 * 3. Assert the state is `abandoned` via the legacy-age reason — proving the
 *    corrupt-owner path routed to the age check instead of `released`.
 */
export const test_inspectpluginbuildlock_treats_corrupt_owner_as_legacy_lock =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-observe-");
    const lockDir = path.join(root, "entry.lock");
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, "owner.json"), "{not json", "utf8");
    const old = new Date(Date.now() - 120_000);
    fs.utimesSync(lockDir, old, old);

    const observation = inspectPluginBuildLock(lockDir, Date.now());

    assert.equal(observation.state, "abandoned");
    const reason = observation.state === "abandoned" ? observation.reason : "";
    assert.match(reason, /legacy lock has no owner\.json/);
  };
