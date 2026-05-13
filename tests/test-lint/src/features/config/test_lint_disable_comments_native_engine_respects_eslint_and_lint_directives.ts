import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint disable comments: native engine respects eslint and lint
 * directives.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_disable_comments_native_engine_respects_eslint_and_lint_directives =
  () => {
    const result = runLint({
      name: "native-inline-disable-directives",
      source: `var before = 1;
// eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any -- deliberate
var skipped: any = 2;
var sameLine = 3; debugger; // lint-disable-line no-var, no-debugger
/* eslint-disable no-var */
var blockSkipped = 4;
/* eslint-enable no-var */
var after = 5;
const text = "// eslint-disable-next-line no-var";
var stringNotDirective = 6;
`,
      rules: {
        "no-var": "error",
        "no-debugger": "error",
        "no-explicit-any": "error",
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.line]),
      [
        ["no-var", 1],
        ["no-var", 8],
        ["no-var", 10],
      ],
      result.stderr,
    );
  };
