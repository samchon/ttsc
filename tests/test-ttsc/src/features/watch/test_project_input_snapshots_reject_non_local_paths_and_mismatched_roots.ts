import assert from "node:assert/strict";
import path from "node:path";

import {
  isAbsoluteLocalProjectInputPath,
  mergeProjectInputSnapshots,
  parseProjectInputSnapshot,
} from "../../../../../packages/ttsc/lib/compiler/internal/runBuild.js";

/**
 * Verifies the launcher accepts only absolute local dependency snapshots and
 * refuses to merge producer views of different physical projects.
 *
 * 1. Reject relative files, remote URLs, and relative roots at the decoder.
 * 2. Reject two otherwise-valid snapshots that publish different roots.
 * 3. Merge duplicate absolute entries under one consistent root.
 */
export const test_project_input_snapshots_reject_non_local_paths_and_mismatched_roots =
  () => {
    const root = path.resolve("project-input-root");
    const plugin = { name: "@ttsc/test-project-inputs" } as never;
    const invalidSnapshots = [
      { root, files: ["docs/spec.md"], globs: [] },
      { root, files: ["https://example.com/openapi.json"], globs: [] },
      { root: "relative-root", files: [], globs: [] },
    ];
    for (const snapshot of invalidSnapshots) {
      assert.throws(
        () => parseProjectInputSnapshot(JSON.stringify(snapshot), plugin),
        /is not an absolute local path/,
      );
    }

    const first = {
      root,
      files: [path.join(root, "docs", "spec.md")],
      globs: [path.join(root, "api", "**", "*.json")],
    };
    assert.throws(
      () =>
        mergeProjectInputSnapshots(root, [
          first,
          { root: path.resolve("other-project"), files: [], globs: [] },
        ]),
      /differs from the selected project root/,
    );
    assert.throws(
      () =>
        mergeProjectInputSnapshots(root, [
          { root: path.resolve("foreign-project"), files: [], globs: [] },
        ]),
      /differs from the selected project root/,
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath("\\root-only\\spec.md", "win32"),
      false,
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath("C:\\project\\spec.md", "win32"),
      true,
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath(
        "\\\\server\\share\\project\\spec.md",
        "win32",
      ),
      true,
    );
    assert.deepEqual(mergeProjectInputSnapshots(root, [first, first]), {
      root,
      files: [path.join(root, "docs", "spec.md")],
      globs: [path.join(root, "api", "**", "*.json").split(path.sep).join("/")],
    });
  };
