import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectInputTopologyMayAffect } from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies a directory event is admitted from where it happened.
 *
 * Admission is the only bound on how often a watch session re-reads and
 * re-hashes its declared corpus, and a silent rescan is indistinguishable from
 * a skipped one at the rebuild boundary, so the rule is pinned here. An atomic
 * replacement names the directory that was swapped rather than the declared
 * file whose bytes it changed, and that directory need not contain any
 * declaration — so containment alone drops it. Anything whose parent is off the
 * path to every declaration cannot have re-anchored one, and admitting it would
 * re-fingerprint the corpus once per entry an install creates.
 *
 * 1. Declare one exact file and one glob population inside a project.
 * 2. Admit the sibling directory an atomic replacement leaves behind.
 * 3. Reject an unrelated dependency tree and an unrelated ordinary file.
 */
export const test_project_input_topology_admits_only_anchoring_directories =
  (): void => {
    const root = TestProject.tmpdir("ttsc-project-input-admission-");
    const declared = path.join(root, "docs", "nested", "missing.md");
    const replaced = path.join(root, "docs-old");
    const dependencies = path.join(root, "node_modules", "pkg", "dist");
    for (const directory of [path.dirname(declared), replaced, dependencies]) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(declared, "declared\n", "utf8");
    fs.writeFileSync(path.join(root, "README.md"), "unrelated\n", "utf8");
    const snapshot = {
      root,
      files: [declared],
      globs: [path.join(root, "api", "**", "*.json")],
    };

    for (const [label, location, expected] of [
      ["the replaced sibling of a declared ancestor", replaced, true],
      ["a declared ancestor itself", path.join(root, "docs"), true],
      // The dependency root sits directly beside a declared ancestor, so it is
      // admitted while everything below it is not. That pair is the rule: depth
      // one costs a rescan, the thousands of entries beneath it cost nothing.
      [
        "a dependency root beside a declared ancestor",
        path.join(root, "node_modules"),
        true,
      ],
      [
        "an unrelated dependency package",
        path.join(root, "node_modules", "pkg"),
        false,
      ],
      ["an unrelated dependency subtree", dependencies, false],
      ["an unrelated ordinary file", path.join(root, "README.md"), false],
      ["a missing glob root", path.join(root, "api"), true],
    ] as const) {
      assert.equal(
        projectInputTopologyMayAffect(snapshot, location, new Map()),
        expected,
        `${label} must ${expected ? "be admitted" : "stay outside"} the rescan`,
      );
    }
  };
