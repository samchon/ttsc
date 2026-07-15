import assert from "node:assert/strict";

import { assertLintDiagnostics } from "../../helpers/assertLintCase";

/**
 * Verifies lint corpus diagnostics: only the resolved main file may satisfy it.
 *
 * Rule, severity, and line alone let a companion diagnostic impersonate the
 * expected main-source failure. File identities must tolerate portable path
 * spelling without accepting a different source target.
 *
 * 1. Compare POSIX, Windows-separator, and case-variant main-file diagnostics.
 * 2. Compare a companion diagnostic with the same rule, severity, and line.
 * 3. Assert portable main spellings pass and the companion spelling fails.
 */
export const test_lint_corpus_diagnostics_are_attributed_to_main_source =
  (): void => {
    const sourcePath = "src/Main.ts";
    const expected = [
      { rule: "fixture/rule", severity: "error", line: 2 },
    ] as const;
    const diagnostic = (file: string) => [
      {
        file,
        line: 2,
        column: 1,
        severity: "error" as const,
        rule: "fixture/rule",
        message: "fixture diagnostic",
      },
    ];

    for (const file of [
      "src/Main.ts",
      "./src/Main.ts",
      "src\\Main.ts",
      "SRC\\MAIN.TS",
    ]) {
      assert.doesNotThrow(() =>
        assertLintDiagnostics(sourcePath, diagnostic(file), expected),
      );
    }

    assert.throws(
      () =>
        assertLintDiagnostics(
          sourcePath,
          diagnostic("src/helper.ts"),
          expected,
        ),
      /src\/helper\.ts/,
    );
  };
