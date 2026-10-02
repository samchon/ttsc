import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies unavailable lexical topology cannot certify notification coverage.
 *
 * An I/O or permission failure says neither that an input is absent nor that
 * an intermediate component is not a link. Genuine missing paths and observed
 * ordinary inputs retain their separate supported coverage.
 *
 * 1. Construct trackers over real ordinary, missing and nested fixture inputs.
 * 2. Supply EIO or EACCES at the exact lexical input or an intermediate lstat.
 * 3. Require uncertain paths outside the authority set, retain known and absent
 *    inputs, and close every acquired directory watch.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual createHostInputMutationTracker and its pathTraversesSymbolicLink consumer must refuse coverage when lexical topology cannot be observed. The resulting covered set is the notification-proof authority consumed by validators, not a private generation flag planted by the test.
 * @evidence contracts/testing.md#independent-expectations Literal EIO/EACCES are observation failures, unlike native ENOENT on the actually missing fixture path. Real native directory identity and supplied healthy watch acquisition cannot establish an unobserved lexical link's absence; literal covered membership distinguishes that uncertainty.
 * @evidence contracts/testing.md#distinguishing-cases Both permission and I/O failures affect exact-input lstat and intermediate-component lstat. Observed regular input and genuinely missing input retain positive coverage; the exact failure also makes realpath unavailable without fabricating absence. No real watcher is needed for the coverage decision.
 * @evidence contracts/testing.md#execution-ownership This source entry constructs six trackers through maintained filesystem/watch seams over real fixtures. Only named failing operations throw authored errors; all native metadata outside those boundaries remains real. Handles retire in finally and no compiler, native watch helper or host process starts.
 */
export async function test_host_input_coverage_requires_observed_lexical_topology(): Promise<void> {
  const root = fs.realpathSync.native(TestProject.createProject({ "nested/input.txt": "bytes\n" }));
  const file = path.join(root, "nested", "input.txt");
  const missing = path.join(root, "missing.txt");
  const rows = [
    { name: "regular", input: file, failure: undefined, code: undefined, covered: true },
    { name: "genuine absence", input: missing, failure: undefined, code: undefined, covered: true },
    ...(["EIO", "EACCES"] as const).flatMap((code) => [
      { name: `exact ${code}`, input: file, failure: file, code, covered: false },
      { name: `ancestor ${code}`, input: file, failure: path.join(root, "nested"), code, covered: false },
    ]),
  ];
  for (const row of rows) {
    let opened = 0;
    let closed = 0;
    const refuse = (): never => { throw Object.assign(new Error("authored unavailable topology"), { code: row.code }); };
    const filesystem = {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
      caseSensitive: () => true,
      lstat: (location: string) => location === row.failure ? refuse() : DEFAULT_FILESYSTEM_OPERATIONS.lstat(location),
      realpath: (location: string) => location === row.failure && row.failure === row.input
        ? refuse() : DEFAULT_FILESYSTEM_OPERATIONS.realpath(location),
      watch: (directory: string) => {
        assert.equal(fs.statSync(directory).isDirectory(), true);
        ++opened;
        return { close: () => { ++closed; } };
      },
    };
    const tracker = await createHostInputMutationTracker([row.input], filesystem, new Set([row.input]), "all", root);
    try {
      assert.equal(tracker.failed, false, row.name + ": actual directory watch is available");
      assert.equal(tracker.covered.has(row.input), row.covered, row.name);
      assert.equal(tracker.membershipChanged, false, row.name + ": uncertainty is not a fabricated mutation");
    } finally {
      tracker.close();
    }
    assert.equal(closed, opened, row.name);
  }
}
