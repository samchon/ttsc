import { TestLint } from "../../../../utils/src/lint/TestLint";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  collectExtraSources,
  listLintCases,
} from "../../helpers/assertLintCase";

/**
 * Verifies lint corpus companions: one grouped entry consumes each source once.
 *
 * The old collector prefixed a companion's existing `src/` path a second time,
 * leaving imports unresolved at `src/src/...`. Explicit companions remain out
 * of the entry list and preserve their case-root-relative project path.
 *
 * 1. Materialize one grouped entry and one marked `src/` companion.
 * 2. Discover entries and collect the entry's extra sources.
 * 3. Assert the project contains `src/types.ts` and no doubled path.
 *
 * @evidence contracts/testing.md#behavioral-verification Discovery excludes a marked companion from the entry list, collection preserves src/types.ts, and TestLint.createProject materializes that path without a second src prefix.
 * @evidence contracts/testing.md#independent-expectations The fixture author supplies one entry and one companion; literal entry/path expectations and filesystem observations independently verify the generated project.
 * @evidence contracts/testing.md#distinguishing-cases One positive entry consumes one marked companion; the correct target exists and src/src/types.ts does not. Invalid or ambiguous companions have separate rejection tests.
 * @evidence contracts/testing.md#execution-ownership Calls discovery, collection and the authored project-materialization helper directly, then cleans both fixture and project; it never invokes TestLint.run or a compiler.
 */
export const test_lint_corpus_companion_sources_are_classified_and_materialized_once =
  (): void => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-companion-corpus-"),
    );
    const caseRoot = path.join(root, "type-aware-case");
    let project: TestLint.IRunLintProject | undefined;
    try {
      fs.mkdirSync(path.join(caseRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(caseRoot, "violation.ts"),
        "// expect: fixture/rule error\nimport type { Box } from './types';\n",
        "utf8",
      );
      fs.writeFileSync(
        path.join(caseRoot, "src", "types.ts"),
        "// @ttsc-corpus-companion\nexport interface Box { value: string }\n",
        "utf8",
      );

      assert.deepEqual(listLintCases(root), ["type-aware-case/violation.ts"]);
      const extraSources = collectExtraSources(
        "type-aware-case/violation.ts",
        root,
      );
      assert.deepEqual(Object.keys(extraSources), ["src/types.ts"]);
      project = TestLint.createProject({
        name: "corpus-companion-path",
        source: fs.readFileSync(path.join(caseRoot, "violation.ts"), "utf8"),
        extraSources,
      });
      assert.equal(
        fs.existsSync(path.join(project.tmpdir, "src", "types.ts")),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(project.tmpdir, "src", "src", "types.ts")),
        false,
      );
    } finally {
      project?.cleanup();
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
