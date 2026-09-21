import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/createHostInputMutationTracker.mjs";

/**
 * Verifies the host-input tracker covers an input outside the project whose own
 * directory it watches, though a link lies at or above that directory, and
 * still refuses one that is itself a link or lies below a link inside the
 * project (samchon/ttsc#1459).
 *
 * The coverage walk stopped only at the project root, so an external input
 * below any link, every macOS temporary directory among them, was examined all
 * the way up and never covered: each delivery proved it by reading. The
 * directory watched for an input is what a delivery re-checks by identity
 * (`verifyLocations`), so the walk stops there for an external input, its own
 * directory, as it does at the root for an internal one; only a link between an
 * input and its watched directory can move the input silently.
 *
 * 1. Register an existing external input and a missing one, each named through a
 *    link above their directories, and one whose own directory is a link, and
 *    assert all three are covered.
 * 2. Register an internal input below a link inside the project, and, where a file
 *    link needs no elevation, an input that is itself a link, and assert
 *    neither is covered.
 */
export async function test_host_input_tracker_covers_an_external_input_below_a_link(): Promise<void> {
  const physical = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-tracker-link-"),
  );
  TestProject.writeFiles(physical, {
    "external/dep/index.d.ts": "export {};\n",
    "external/target/real.d.ts": "export {};\n",
    "project/src/main.ts": "export {};\n",
    "project/vendor/real.d.ts": "export {};\n",
  });
  const directoryLink = process.platform === "win32" ? "junction" : "dir";
  const linked = path.join(TestProject.tmpdir("ttsc-link-"), "tree");
  fs.symlinkSync(physical, linked, directoryLink);
  const at = (...segments: string[]): string => path.join(linked, ...segments);
  fs.symlinkSync(
    path.join(physical, "external", "target"),
    at("external", "inner"),
    directoryLink,
  );
  fs.symlinkSync(
    path.join(physical, "project", "vendor"),
    at("project", "src", "linked"),
    directoryLink,
  );
  // A file link is reproducible without elevation on POSIX only.
  const aliasFile =
    process.platform === "win32" ? undefined : at("external", "alias.d.ts");
  if (aliasFile !== undefined) {
    fs.symlinkSync(
      path.join(physical, "external", "target", "real.d.ts"),
      aliasFile,
      "file",
    );
  }
  const existing = at("external", "dep", "index.d.ts");
  const missing = at("external", "dep", "absent.d.ts");
  const belowInnerLink = at("external", "inner", "real.d.ts");
  const internalBelowLink = at("project", "src", "linked", "real.d.ts");
  const inputs = [
    existing,
    missing,
    belowInnerLink,
    internalBelowLink,
    ...(aliasFile === undefined ? [] : [aliasFile]),
  ];
  const tracker = await createHostInputMutationTracker(
    inputs,
    {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
      watch: () => ({ close: () => undefined }),
    },
    new Set(inputs),
    "all",
    at("project"),
  );
  try {
    assert.equal(
      tracker.covered?.has(existing),
      true,
      "an existing external input below a link above its directory is covered",
    );
    assert.equal(
      tracker.covered?.has(missing),
      true,
      "a missing external input below a link above its directory is covered",
    );
    assert.equal(
      tracker.covered?.has(belowInnerLink),
      true,
      "an external input whose own directory is a link is covered: the link is the watched directory, re-checked by identity",
    );
    assert.equal(
      tracker.covered?.has(internalBelowLink),
      false,
      "an internal input below a link inside the project is not covered",
    );
    if (aliasFile !== undefined) {
      assert.equal(
        tracker.covered?.has(aliasFile),
        false,
        "an input that is itself a link stays on metadata validation",
      );
    }
  } finally {
    tracker.close();
  }
}
