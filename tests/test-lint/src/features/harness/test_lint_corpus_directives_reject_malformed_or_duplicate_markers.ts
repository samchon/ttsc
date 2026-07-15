import { TestLint } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  applyCorpusOptions,
  resolveCorpusSourcePath,
} from "../../helpers/assertLintCase";

/**
 * Verifies corpus directives: marker-shaped typos and duplicates fail loudly.
 *
 * A valid expectation can keep a fixture classified after a malformed option or
 * filename directive is ignored, falsely leaving an option/path branch
 * uncovered. Every reserved directive token must therefore parse exactly once.
 *
 * 1. Mix valid directives with missing-colon and duplicate markers.
 * 2. Parse each source through the same option and filename helpers as corpus.
 * 3. Assert malformed and duplicate contracts report before execution.
 */
export const test_lint_corpus_directives_reject_malformed_or_duplicate_markers =
  (): void => {
    const rules = (): Record<string, TestLint.LintRuleConfigEntry> => ({
      "rule/name": "error",
    });

    assert.throws(
      () =>
        applyCorpusOptions(
          "mixed-options.ts",
          [
            '// @ttsc-corpus-options: rule/name {"enabled":true}',
            "// @ttsc-corpus-options rule/name {}",
          ].join("\n"),
          rules(),
        ),
      /mixed-options\.ts.*malformed.*corpus-options/,
    );
    assert.throws(
      () =>
        applyCorpusOptions(
          "duplicate-options.ts",
          [
            '// @ttsc-corpus-options: rule/name {"enabled":true}',
            '// @ttsc-corpus-options: rule/name {"enabled":false}',
          ].join("\n"),
          rules(),
        ),
      /duplicate-options\.ts.*duplicate.*rule\/name/,
    );
    assert.throws(
      () =>
        resolveCorpusSourcePath(
          [
            "// @ttsc-corpus-filename: src/valid.ts",
            "// @ttsc-corpus-filename src/ignored.ts",
          ].join("\n"),
          "mixed-filename.ts",
        ),
      /mixed-filename\.ts.*malformed.*corpus-filename/,
    );
    assert.throws(
      () =>
        resolveCorpusSourcePath(
          [
            "// @ttsc-corpus-filename: src/first.ts",
            "// @ttsc-corpus-filename: src/second.ts",
          ].join("\n"),
          "duplicate-filename.ts",
        ),
      /duplicate-filename\.ts.*at most one corpus-filename/,
    );
  };
