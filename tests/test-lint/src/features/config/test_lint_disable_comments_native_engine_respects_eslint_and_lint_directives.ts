import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that the native engine honours both `eslint-disable-*` and
 * `lint-disable-*` inline directives, including block, next-line, and same-line
 * forms.
 *
 * Pins the directive parser in the Go-side native engine. Seven distinct cases
 * are embedded in the source: one clean `var` (must fire), one disabled with
 * `eslint-disable-next-line` (must not fire), one disabled with
 * `lint-disable-line` (must not fire), a `var` inside an `eslint-disable` …
 * `eslint-enable` block (must not fire), one after `eslint-enable` (must fire),
 * one in a string literal that looks like a directive (must not suppress), and
 * one that follows the string-literal non-directive (must fire).
 *
 * 1. Construct a source with all seven patterns.
 * 2. Run ttsc with `no-var: error`, `no-debugger: error`, `no-explicit-any:
 *    error`.
 * 3. Assert only lines 1, 8, and 10 produce diagnostics.
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
