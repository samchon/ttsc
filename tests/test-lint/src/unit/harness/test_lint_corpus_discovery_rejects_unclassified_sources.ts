import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { listLintCases } from "../../helpers/assertLintCase";

/**
 * Verifies lint corpus discovery: unclassified TypeScript sources are rejected.
 *
 * Filtering on parsed expectations made an annotation typo indistinguishable
 * from an unrelated file. Discovery must enumerate the source first and then
 * demand an explicit positive, audited-skip, or companion role.
 *
 * 1. Materialize one plain TypeScript file in an isolated corpus root.
 * 2. Discover the corpus without adding any role directive.
 * 3. Assert discovery fails with the unclassified relative path.
 *
 * @evidence contracts/testing.md#behavioral-verification listLintCases rejects forgotten.ts when a TypeScript source declares no positive expectation, audited skip or companion role.
 * @evidence contracts/testing.md#independent-expectations The authored unmarked source is deliberately outside all permitted roles; a literal filename and role error expectation prevents a silent empty result from passing.
 * @evidence contracts/testing.md#distinguishing-cases The plain source is the negative case; the canonical extension and companion discovery cases own the adjacent correctly classified controls.
 * @evidence contracts/testing.md#execution-ownership Calls discovery on one temporary source tree and cleans it in finally, without executing a fixture or invoking a product process.
 */
export const test_lint_corpus_discovery_rejects_unclassified_sources =
  (): void => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-unclassified-corpus-"),
    );
    try {
      fs.writeFileSync(
        path.join(root, "forgotten.ts"),
        "export const forgotten = true;\n",
        "utf8",
      );
      assert.throws(
        () => listLintCases(root),
        /forgotten\.ts: a corpus source must declare an expectation, audited skip, or @ttsc-corpus-companion/,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
