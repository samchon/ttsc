import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectInputTopologyMayAffect } from "../../../../../packages/ttsc/src/launcher/internal/watch/projectInputTopologyMayAffect";
import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createProjectInputPathIdentityContext";
import { ProjectInputWatchRules } from "../../../../../packages/ttsc/src/launcher/internal/watch/ProjectInputWatchRules";
import { WatchPaths } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchPaths";

/**
 * Verifies a directory event is admitted from where it happened.
 *
 * Admission excludes unrelated paths before corpus rescanning; scheduling and
 * debounce remain with the launcher. A replacement can name a sibling directory
 * rather than the declared file, so containment alone can miss it. The selected
 * directory inputs contrast that anchoring possibility with unrelated deep
 * dependency trees, without creating a real replacement or measuring rehashes.
 *
 * 1. Declare one exact file and one glob population inside a project.
 * 2. Admit the sibling directory an atomic replacement leaves behind.
 * 3. Admit the dependency root beside it and reject everything below that root,
 *    which is the pair the rule turns on.
 * 4. Keep a missing glob root admissible and contrast previous members beneath
 *    a missing child with previous members beneath its sibling.
 *
 * @evidence contracts/testing.md#behavioral-verification projectInputTopologyMayAffect preserves the seven original admission decisions and admits a missing non-anchoring glob child only when the previous population contains a member beneath that child.
 * @evidence contracts/testing.md#independent-expectations An atomic replacement can move a declared ancestor while unrelated dependency descendants cannot move any declaration. Removing api/removed can affect the authored previous api/removed/x.json member, but cannot affect the sibling api/other/x.json member; these true/false expectations do not come from the predicate's result.
 * @evidence contracts/testing.md#distinguishing-cases Replaced siblings, declared ancestors and the top dependency root are admitted; deeper dependency trees and ordinary files are rejected; missing glob roots remain admitted. The same absent child below the declared glob root is non-anchoring and not a directory: previous removed/x.json admits it, while previous other/x.json does not.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/watch; it calls the actual admission predicate with default native identity, the original empty previous populations and two supplied previous-member populations over TestProject-owned directories/files. Native stat/identity and any read-only case query classify the supplied paths; no watcher, compiler or product host starts. The case observes admission only, not a corpus rehash or actual atomic replacement.
 */
export function test_project_input_topology_admits_only_anchoring_directories(): void {
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
    const removed = path.join(root, "api", "removed");
    assert.equal(path.relative(path.join(root, "api"), removed), "removed");
    assert.equal(fs.existsSync(removed), false, "the changed child is absent");
    assert.equal(WatchPaths.isDirectory(removed), false);
    assert.equal(
      ProjectInputWatchRules.projectInputAnchorsDeclaration(
        snapshot,
        removed,
        createProjectInputPathIdentityContext(),
      ),
      false,
      "the missing child does not anchor any declaration",
    );
    assert.equal(
      projectInputTopologyMayAffect(
        snapshot,
        removed,
        new Map([["removed input", path.join(removed, "x.json")]]),
      ),
      true,
      "a previous member beneath the missing child admits that topology change",
    );
    assert.equal(
      projectInputTopologyMayAffect(
        snapshot,
        removed,
        new Map([["other input", path.join(root, "api", "other", "x.json")]]),
      ),
      false,
      "a previous sibling member cannot admit the missing child",
    );
  }
