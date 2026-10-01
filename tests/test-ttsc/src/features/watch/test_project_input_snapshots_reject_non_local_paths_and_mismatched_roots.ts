import assert from "node:assert/strict";
import path from "node:path";

import { isAbsoluteLocalProjectInputPath } from "../../../../../packages/ttsc/src/compiler/internal/build/isAbsoluteLocalProjectInputPath";
import { mergeProjectInputSnapshots } from "../../../../../packages/ttsc/src/compiler/internal/build/mergeProjectInputSnapshots";
import { parseProjectInputSnapshot } from "../../../../../packages/ttsc/src/compiler/internal/build/parseProjectInputSnapshot";

/**
 * Verifies the launcher accepts only absolute local dependency snapshots and
 * refuses to merge producer views of different physical projects.
 *
 * A malformed opt-in sidecar must fail before it can redirect a long-lived
 * watcher to an unrelated or remote namespace; silent path resolution would
 * make the launcher observe a different project than the plugin evaluated.
 *
 * 1. Reject relative/remote/NUL reload files and resolution directories.
 * 2. Reject two otherwise-valid snapshots that publish different roots.
 * 3. Accept an old snapshot without reload metadata and merge identical duplicate declarations.
 *
 * @evidence contracts/testing.md#behavioral-verification Invokes parseProjectInputSnapshot, mergeProjectInputSnapshots and isAbsoluteLocalProjectInputPath to reject malformed/foreign views and retain exact validated reload/file/glob populations.
 * @evidence contracts/testing.md#independent-expectations Absolute-local namespace and same-selected-root protocol requirements define rejection. Independent literal normalized lists establish duplicate collapse and omitted optional reload fields; explicit Windows/POSIX syntax inputs do not derive answers from the parser.
 * @evidence contracts/testing.md#distinguishing-cases Relative/URL/NUL paths, wrong reload-list shapes and foreign roots contrast with old producer omission and identical duplicate snapshots. Drive/UNC/extended paths succeed while root-only, wildcard-volume, device and pipe namespaces reject; POSIX slash-root remains valid.
 * @evidence contracts/testing.md#execution-ownership The exported source unit calls owning parsers and merger directly. Merge may observe local filesystem identity for supplied nonexistent paths but starts no host or watcher; explicit platform grammar is portable, and this duplicate snapshot case does not claim genuine symlink-alias validation.
 */
export const test_project_input_snapshots_reject_non_local_paths_and_mismatched_roots =
  () => {
    const root = path.resolve("project-input-root");
    const plugin = { name: "@ttsc/test-project-inputs" } as never;
    const invalidSnapshots = [
      { root, files: ["docs/spec.md"], globs: [] },
      { root, files: ["https://example.com/openapi.json"], globs: [] },
      { root: "relative-root", files: [], globs: [] },
      { root, files: [], globs: [], reloadFiles: ["lint.config.json"] },
      {
        root,
        files: [],
        globs: [],
        reloadFiles: ["https://example.com/lint.config.json"],
      },
      {
        root,
        files: [],
        globs: [],
        reloadFiles: [`${path.join(root, "lint.config.json")}\0ignored`],
      },
      {
        root,
        files: [],
        globs: [],
        reloadDirectories: ["config-deps"],
      },
      {
        root,
        files: [],
        globs: [],
        reloadDirectories: ["https://example.com/node_modules"],
      },
      {
        root,
        files: [],
        globs: [],
        reloadDirectories: [`${path.join(root, "config-deps")}\0ignored`],
      },
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
      reloadDirectories: [path.join(root, "config-deps")],
      reloadFiles: [path.join(root, "lint.config.json")],
    };
    assert.deepEqual(
      parseProjectInputSnapshot(
        JSON.stringify({ root, files: [], globs: [] }),
        plugin,
      ),
      {
        root,
        files: [],
        globs: [],
        reloadDirectories: [],
        reloadFiles: [],
      },
      "an older producer may omit the optional reload metadata",
    );
    assert.throws(
      () =>
        parseProjectInputSnapshot(
          JSON.stringify({ root, files: [], globs: [], reloadFiles: root }),
          plugin,
        ),
      /invalid snapshot/,
    );
    assert.throws(
      () =>
        parseProjectInputSnapshot(
          JSON.stringify({
            root,
            files: [],
            globs: [],
            reloadDirectories: root,
          }),
          plugin,
        ),
      /invalid snapshot/,
    );
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
      isAbsoluteLocalProjectInputPath("/root-only/spec.md", "win32"),
      false,
      "a slash-rooted path still depends on the launcher's current drive",
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
    assert.equal(
      isAbsoluteLocalProjectInputPath("\\\\server\\share", "win32"),
      true,
      "a UNC share root is an absolute local filesystem path",
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath(
        "\\\\server\\*\\project\\spec.md",
        "win32",
      ),
      false,
      "a UNC share is a fixed volume, not a glob population",
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath(
        "\\\\?\\GLOBALROOT\\Device\\HarddiskVolume1",
        "win32",
      ),
      false,
      "a device namespace is not a declared local filesystem path",
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath(
        "\\\\?\\C:\\project\\docs\\spec.md",
        "win32",
      ),
      true,
      "an extended-length drive path remains a local filesystem path",
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath(
        "\\\\?\\UNC\\server\\share\\docs\\spec.md",
        "win32",
      ),
      true,
      "an extended-length UNC path remains a local filesystem path",
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath(
        "\\\\?\\UNC\\server\\?\\docs\\spec.md",
        "win32",
      ),
      false,
      "an extended UNC share must also name a fixed volume",
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath("\\\\.\\pipe\\ttsc", "win32"),
      false,
      "a named-pipe namespace is not a declared local filesystem path",
    );
    assert.equal(
      isAbsoluteLocalProjectInputPath("/project/docs/spec.md", "linux"),
      true,
      "the same slash-rooted spelling is a complete POSIX identity",
    );
    assert.deepEqual(mergeProjectInputSnapshots(root, [first, first]), {
      root,
      files: [path.join(root, "docs", "spec.md")],
      globs: [path.join(root, "api", "**", "*.json").split(path.sep).join("/")],
      reloadDirectories: [path.join(root, "config-deps")],
      reloadFiles: [path.join(root, "lint.config.json")],
    });
  };
