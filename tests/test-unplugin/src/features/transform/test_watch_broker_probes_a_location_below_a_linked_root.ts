import assert from "node:assert/strict";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import { probeForLocation } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/probeForLocation.mjs";

/**
 * Verifies a brokered watch location is probed when the project root contains
 * it, whether or not the root is spelled through a link (samchon/ttsc#1453,
 * samchon/ttsc#1454).
 *
 * The location reaches the broker canonical, after every link, while the probe
 * root is the project root as the adapter names it. On macOS every temporary
 * directory is a link, `/var/…` to `/private/var/…`, so compared as spelled the
 * two shared no prefix and no stream of the whole suite was ever probed: each
 * reported ready before its opening probe, heard the writes made just before it
 * as its own, and answered no drain with proof. Measured on the fourth macOS
 * run of the suite (run 35493986854), whose captures were rejected for
 * membership events on files written before the stream existed.
 *
 * 1. Resolve a location below a root spelled through a link, on a filesystem whose
 *    realpath maps the link to its target, and assert it carries a probe below
 *    the root's own spelling.
 * 2. Assert a location outside the root, and one with no root, carry none.
 */
export async function test_watch_broker_probes_a_location_below_a_linked_root(): Promise<void> {
  const linked = path.resolve("/var/project");
  const physical = path.resolve("/private/var/project");
  const filesystem = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    realpath: (location: string) =>
      location === linked || location.startsWith(`${linked}${path.sep}`)
        ? path.join(physical, path.relative(linked, location))
        : location,
  };
  const probeDirectory = (root: string) => path.join(root, ".probes");

  assert.deepEqual(
    probeForLocation(
      path.join(physical, "src"),
      linked,
      probeDirectory,
      filesystem,
    ),
    { directory: path.join(linked, ".probes"), root: linked },
    "a location below the linked root is probed, under the root's spelling",
  );
  assert.deepEqual(
    probeForLocation(physical, linked, probeDirectory, filesystem),
    { directory: path.join(linked, ".probes"), root: linked },
    "the root itself is probed",
  );
  assert.equal(
    probeForLocation(
      path.resolve("/private/var/elsewhere"),
      linked,
      probeDirectory,
      filesystem,
    ),
    undefined,
    "a location outside the root is not",
  );
  assert.equal(
    probeForLocation(
      path.join(physical, "src"),
      undefined,
      probeDirectory,
      filesystem,
    ),
    undefined,
    "a tracker with no root probes nothing",
  );
}
