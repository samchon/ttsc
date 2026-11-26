import assert from "node:assert/strict";

import { TrustedNodeOptions } from "../../../../../packages/ttsc/src/internal/TrustedNodeOptions";

/**
 * Verifies `TrustedNodeOptions.parse` follows Node's `ParseNodeOptionsEnvVar`
 * whitespace, double-quoting and backslash rules.
 *
 * Option splitting must agree with Node so a quoted preload path or malformed
 * `NODE_OPTIONS` string is never interpreted differently from the child runtime
 * that executes it.
 *
 * 1. Split empty, whitespace-only and ASCII-whitespace-separated options.
 * 2. Group double-quoted spans, unescape backslashes inside quotes and keep
 *    unquoted backslashes and single quotes literal.
 * 3. Reject unterminated double quotes and trailing in-string backslashes with
 *    `null`.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls TrustedNodeOptions.parse directly and asserts exact token arrays and null error returns across valid and malformed NODE_OPTIONS inputs.
 * @evidence contracts/testing.md#independent-expectations Expected token arrays and null failures derive from Node's documented ParseNodeOptionsEnvVar rules rather than implementation internals.
 * @evidence contracts/testing.md#distinguishing-cases Covers empty, whitespace-only, spaces/tabs/newlines, quoted paths with spaces, escaped quotes and backslashes inside quotes, literal Windows backslashes outside quotes, literal single quotes, empty quoted forms, unterminated quotes and trailing escapes.
 * @evidence contracts/testing.md#execution-ownership Pure unit test calling TrustedNodeOptions.parse in-process without filesystem or child-process dependencies.
 */
export function test_trustednodeoptions_parses_node_options_env_rules(): void {
  assert.deepEqual(TrustedNodeOptions.parse(""), []);
  assert.deepEqual(TrustedNodeOptions.parse("  \t\r\n "), []);
  assert.deepEqual(TrustedNodeOptions.parse("--require=/a.cjs\t-r\n/b.cjs"), [
    "--require=/a.cjs",
    "-r",
    "/b.cjs",
  ]);
  assert.deepEqual(
    TrustedNodeOptions.parse('--require "/path with spaces/port zero.cjs"'),
    ["--require", "/path with spaces/port zero.cjs"],
  );
  assert.deepEqual(
    TrustedNodeOptions.parse('--require="/path with \\"q\\" and \\\\s/p.cjs"'),
    ['--require=/path with "q" and \\s/p.cjs'],
  );
  assert.deepEqual(
    TrustedNodeOptions.parse("-r C:\\Users\\dev\\port-zero.cjs"),
    ["-r", "C:\\Users\\dev\\port-zero.cjs"],
  );
  assert.deepEqual(TrustedNodeOptions.parse("-r 'port-zero.cjs'"), [
    "-r",
    "'port-zero.cjs'",
  ]);
  assert.deepEqual(TrustedNodeOptions.parse('--require ""'), ["--require"]);
  assert.deepEqual(TrustedNodeOptions.parse('--require=""'), ["--require="]);
  assert.equal(TrustedNodeOptions.parse('--require "/unterminated'), null);
  assert.equal(TrustedNodeOptions.parse('--require "/trailing\\'), null);
}
