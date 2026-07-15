import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  collectExtraSources,
  listLintCases,
} from "../../helpers/assertLintCase";

/**
 * Verifies lint corpus companions: nested grouped cases keep separate owners.
 *
 * Recursive collection must not let an outer entry consume the companion of a
 * nested grouped case. Each companion belongs to the one positive entry whose
 * case directory contains it in that case's project-level `src/` subtree.
 *
 * 1. Materialize nested grouped entries with one companion each.
 * 2. Validate the complete corpus ownership graph.
 * 3. Assert each entry collects only its own companion path.
 */
export const test_lint_corpus_nested_companions_are_consumed_only_by_their_owner =
  (): void => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-nested-companion-corpus-"),
    );
    const files: Readonly<Record<string, string>> = {
      "outer/violation.ts":
        "// expect: fixture/outer error\nexport const outer = true;\n",
      "outer/src/outer.ts":
        "// @ttsc-corpus-companion\nexport const outerHelper = true;\n",
      "outer/nested/violation.ts":
        "// expect: fixture/nested error\nexport const nested = true;\n",
      "outer/nested/src/nested.ts":
        "// @ttsc-corpus-companion\nexport const nestedHelper = true;\n",
    };
    try {
      for (const [relativeFile, source] of Object.entries(files)) {
        const target = path.join(root, relativeFile);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, source, "utf8");
      }
      assert.equal(listLintCases(root).length, 2);
      assert.deepEqual(
        Object.keys(collectExtraSources("outer/violation.ts", root)),
        ["src/outer.ts"],
      );
      assert.deepEqual(
        Object.keys(collectExtraSources("outer/nested/violation.ts", root)),
        ["src/nested.ts"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
