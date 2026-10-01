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
 * @evidence contracts/testing.md#behavioral-verification Calls production parseFlags and getNumber for the checker option, asserting exact rejected diagnostics and numeric values passed to compiler options.
 * @evidence contracts/testing.md#independent-expectations Literal invalid strings and literal expected numbers define the oracle, with complete JSON-quoted diagnostics rather than recomputing validity through another parser.
 * @evidence contracts/testing.md#distinguishing-cases Preserves zero, scientific, hexadecimal, fractional, signed and zero-padded inputs from the original CLI cases and adds negative, empty and missing operands.
 * @evidence contracts/testing.md#execution-ownership The named unit/compiler export invokes authored flag functions directly without fixtures, product subprocesses, native builds or duplicated compile work.
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
