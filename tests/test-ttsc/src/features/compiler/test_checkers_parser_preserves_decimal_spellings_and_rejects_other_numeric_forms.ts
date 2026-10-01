import assert from "node:assert/strict";

import { getNumber } from "../../../../../packages/ttsc/src/flags/getNumber";
import { parseFlags } from "../../../../../packages/ttsc/src/flags/parseFlags";

/**
 * Verifies the launcher's checker-count decision independently of compilation.
 *
 * Go accepts signed decimal digits, not JavaScript scientific, hexadecimal or
 * fractional forms. These exact previous CLI inputs exercise the authored
 * flag parser before any project or compiler is needed.
 *
 * 1. Reject 0, 1e3, 0x10, 2.0, -1 and the empty string in the --checkers=<raw> spelling, and 0, 1e3, 0x10 and 2.0 in the separate-value spelling, with the exact message.
 * 2. Reject a separate dash-leading value (-1) and a missing value with their own messages.
 * 3. Accept +2, 02 and 2 in both spellings and require getNumber to return 2 with no passthrough or positional leftovers.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls production parseFlags and getNumber for the checker option, asserting exact rejected diagnostics and numeric values passed to compiler options.
 * @evidence contracts/testing.md#independent-expectations Literal invalid strings and literal expected numbers define the oracle, with complete JSON-quoted diagnostics rather than recomputing validity through another parser.
 * @evidence contracts/testing.md#distinguishing-cases Rejected: zero, scientific, hexadecimal, fractional, negative and empty counts in the attached spelling (all but the negative and empty ones also in the separate spelling), plus a separate dash-leading value and a missing value; accepted: a signed, a zero-padded and a plain decimal in both spellings, all yielding 2.
 * @evidence contracts/testing.md#execution-ownership A unit test calling parseFlags and getNumber directly with argv arrays; it needs no project, process or compiler.
 */
export function test_checkers_parser_preserves_decimal_spellings_and_rejects_other_numeric_forms(): void {
  for (const raw of ["0", "1e3", "0x10", "2.0", "-1", ""]) {
    assert.throws(() => parseFlags({
      argv: [`--checkers=${raw}`], errorPrefix: "ttsc:", subcommand: "build",
    }), {
      message: `ttsc: --checkers expects a positive integer, got ${JSON.stringify(raw)}`,
    });
    if (raw.length !== 0 && raw !== "-1") {
      assert.throws(() => parseFlags({
        argv: ["--checkers", raw], errorPrefix: "ttsc:", subcommand: "build",
      }), {
        message: `ttsc: --checkers expects a positive integer, got ${JSON.stringify(raw)}`,
      });
    }
  }
  assert.throws(() => parseFlags({
    argv: ["--checkers", "-1"], errorPrefix: "ttsc:", subcommand: "build",
  }), { message: 'ttsc: --checkers requires a value (next token "-1" starts with "-")' });
  assert.throws(() => parseFlags({
    argv: ["--checkers"], errorPrefix: "ttsc:", subcommand: "build",
  }), { message: "ttsc: --checkers requires a value" });
  for (const raw of ["+2", "02", "2"]) {
    for (const argv of [["--checkers", raw], [`--checkers=${raw}`]]) {
      const parsed = parseFlags({ argv, errorPrefix: "ttsc:", subcommand: "build" });
      assert.equal(getNumber(parsed, "--checkers"), 2);
      assert.deepEqual(parsed.passthrough, []);
      assert.deepEqual(parsed.positional, []);
    }
  }
}
