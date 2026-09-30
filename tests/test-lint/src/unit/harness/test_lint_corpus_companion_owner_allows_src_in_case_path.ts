import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  collectExtraSources,
  listLintCases,
} from "../../helpers/assertLintCase";

/**
 * Verifies lint corpus companions: `src` in a case path is not a project root.
 *
 * Ownership follows a positive entry's directory and its own `src/` subtree; it
 * does not infer the project root from the first path segment named `src`.
 *
 * 1. Materialize a grouped case below a directory named `src`.
 * 2. Discover the positive entry and validate its companion ownership.
 * 3. Assert collection preserves the companion's project-relative path.
 *
 * @evidence contracts/testing.md#behavioral-verification listLintCases and collectExtraSources recognize a grouped case beneath an unrelated directory named src, preserving the companion as src/helper.ts.
 * @evidence contracts/testing.md#independent-expectations The authored examples/src/grouped-case tree independently identifies the positive entry and its own src subtree; literal expected paths forbid treating the first src segment as the project root.
 * @evidence contracts/testing.md#distinguishing-cases The outer path and owned subtree both contain src, and entry discovery plus exact companion collection distinguish doubled or truncated paths. Nested ownership rejection is covered by the nested companion case.
 * @evidence contracts/testing.md#execution-ownership Directly calls the authored discovery and collection helpers against a temporary tree and removes it in finally; no project build or host runs.
 */
export const test_lint_corpus_companion_owner_allows_src_in_case_path =
  (): void => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-src-path-companion-corpus-"),
    );
    const caseDirectory = path.join(root, "examples", "src", "grouped-case");
    try {
      fs.mkdirSync(path.join(caseDirectory, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(caseDirectory, "violation.ts"),
        "// expect: fixture/rule error\nexport const violation = true;\n",
        "utf8",
      );
      fs.writeFileSync(
        path.join(caseDirectory, "src", "helper.ts"),
        "// @ttsc-corpus-companion\nexport const helper = true;\n",
        "utf8",
      );

      assert.deepEqual(listLintCases(root), [
        "examples/src/grouped-case/violation.ts",
      ]);
      assert.deepEqual(
        Object.keys(
          collectExtraSources("examples/src/grouped-case/violation.ts", root),
        ),
        ["src/helper.ts"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
