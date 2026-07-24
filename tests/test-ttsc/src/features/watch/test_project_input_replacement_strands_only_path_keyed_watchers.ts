import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectInputReplacementStrandsWatchers } from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies a recursive root is reinstalled only where a replacement strands it.
 *
 * Reinstalling costs one watch descriptor per entry beneath the root and opens
 * a window in which nothing is delivered, so it is worth paying only on the
 * backend that needs it: the per-directory implementation Node uses off macOS
 * and Windows keys its handles by path, so a replaced directory keeps its key
 * and its arriving successor is skipped. Both native subtree backends follow
 * the path instead. A skipped rearm and a silent one look identical at the
 * rebuild boundary, so the rule is pinned here rather than inferred.
 *
 * 1. Declare an exact file, a reload directory, and a glob population.
 * 2. Require a rearm where a declaration is anchored, on the path-keyed backend.
 * 3. Require none on the native backends, for a file, or below a glob root or a
 *    reload directory, whose own digest nothing beneath it can reach.
 */
export const test_project_input_replacement_strands_only_path_keyed_watchers =
  (): void => {
    const root = TestProject.tmpdir("ttsc-project-input-strand-");
    const declared = path.join(root, "docs", "nested", "missing.md");
    const replaced = path.join(root, "docs-old");
    const reloadDirectory = path.join(root, "outside", "config");
    const globDepth = path.join(root, "api", "v1", "schemas");
    for (const directory of [
      path.dirname(declared),
      replaced,
      reloadDirectory,
      path.join(reloadDirectory, "pkg"),
      globDepth,
    ]) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(declared, "declared\n", "utf8");
    fs.writeFileSync(path.join(root, "README.md"), "unrelated\n", "utf8");
    const snapshot = {
      root,
      files: [declared],
      globs: [path.join(root, "api", "**", "*.json")],
      reloadDirectories: [reloadDirectory],
    };

    for (const [label, location, platform, expected] of [
      ["a sibling of a declared ancestor", replaced, "linux", true],
      [
        "a declared reload directory nothing else reaches",
        reloadDirectory,
        "linux",
        true,
      ],
      ["the same replacement on macOS", replaced, "darwin", false],
      ["the same replacement on Windows", replaced, "win32", false],
      ["an ordinary file", path.join(root, "README.md"), "linux", false],
      // A directory this deep inside a glob root still deserves a rescan, and
      // gets one through the admission rule. It replaces nothing a watch root
      // is anchored on, so it must not also pay for a reinstall.
      ["a directory below a glob root", globDepth, "linux", false],
      // A reload directory's fingerprint is a digest of its immediate entries,
      // so nothing below it can reach the corpus. Contributors publish
      // `node_modules` as one, and treating it as its own anchor would rearm
      // once per package an install creates.
      [
        "a directory inside a reload directory",
        path.join(reloadDirectory, "pkg"),
        "linux",
        false,
      ],
    ] as const) {
      assert.equal(
        projectInputReplacementStrandsWatchers(
          snapshot,
          location,
          undefined,
          platform,
        ),
        expected,
        `${label} must ${expected ? "rearm" : "not rearm"} the delivering root`,
      );
    }
  };
