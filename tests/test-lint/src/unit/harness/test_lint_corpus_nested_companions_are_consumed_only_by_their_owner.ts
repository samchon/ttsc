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
 *
 * @evidence contracts/testing.md#behavioral-verification Discovery finds both nested grouped entries, while collectExtraSources assigns each entry only its own src companion.
 * @evidence contracts/testing.md#independent-expectations The separately authored outer and nested case roots define ownership; literal companion arrays independently forbid recursive collection from stealing another entry's source.
 * @evidence contracts/testing.md#distinguishing-cases Both entries have distinct positive markers and marked helpers; the outer entry must exclude the nested helper and the nested entry must retain it.
 * @evidence contracts/testing.md#execution-ownership Directly calls discovery and collection on an isolated temporary tree, removes it in finally, and starts no native host or compiler.
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
