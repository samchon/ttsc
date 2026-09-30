import { TestLint } from "../../../../utils/src/lint/TestLint";
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
 *
 * @evidence contracts/testing.md#behavioral-verification TestLint.parseExpectations resolves stacked line and JSX markers to one statement and targets the TypeScript suppressor for ban-ts-comment.
 * @evidence contracts/testing.md#independent-expectations Literal expected rule/severity/line records are authored independently of the parser and follow the declared marker target semantics.
 * @evidence contracts/testing.md#distinguishing-cases Prose mentioning expect is inert; a line plus JSX marker share statement line eight, while ban-ts-comment points to the suppressor at line ten. The malformed marker case owns rejection twins.
 * @evidence contracts/testing.md#execution-ownership Calls the authored expectation parser once on an in-memory source string; no compiler or corpus materialization occurs.
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
