import { TestLint } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies lint expectations: line and JSX-block markers share one target.
 *
 * JSX fixtures cannot place a `//` comment between JSX children. Mixed marker
 * stacks must therefore recognize both standalone forms and preserve the
 * special ban-ts-comment targeting rule.
 *
 * 1. Parse stacked line and JSX markers followed by one statement.
 * 2. Parse a ban-ts-comment marker followed by a TypeScript suppressor.
 * 3. Assert each marker resolves to the intended source line.
 */
export const test_lint_expectation_parser_accepts_line_and_jsx_block_markers =
  (): void => {
    const source = [
      "/** Mentions `// expect:` as prose, not as a marker. */",
      "// This prose comment mentions expect but is not a marker.",
      "{ /* This JSX prose comment mentions expect but is not a marker. */ }",
      "declare const expect: unknown;",
      "// expect: first/rule error",
      "{ /* expect: second/rule warn */ }",
      "",
      "const value = 1;",
      "// expect: typescript/ban-ts-comment error",
      "// @ts-ignore",
      "const ignored = value;",
    ].join("\n");

    assert.deepEqual(TestLint.parseExpectations(source), [
      { rule: "first/rule", severity: "error", line: 8 },
      { rule: "second/rule", severity: "warn", line: 8 },
      {
        rule: "typescript/ban-ts-comment",
        severity: "error",
        line: 10,
      },
    ]);
  };
