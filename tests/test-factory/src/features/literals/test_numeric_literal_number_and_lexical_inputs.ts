import assert from "node:assert/strict";
import ts from "ts-legacy";

import factory from "../../../../../packages/factory/src/index";
import { print } from "../../internal/helpers";

/**
 * Verifies numeric literal construction accepts numbers and preserves lexical inputs.
 *
 * The existing decimal case converts its number to a string before calling the
 * factory, leaving the public number input untested. Literal text must preserve
 * string notation while number inputs remain executable numeric expressions.
 *
 * 1. Construct zero, integer, decimal and exponent number inputs.
 * 2. Contrast hexadecimal and separated decimal string spellings.
 * 3. Assert exact printed text, clean legacy parsing and evaluated values.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createNumericLiteral and the actual TsPrinter for each number and lexical string, then checks exact output, independent parser acceptance and JavaScript value. A number rejected by the constructor or lexical spelling normalized by the printer fails.
 * @evidence contracts/testing.md#independent-expectations Authored text and numeric result literals establish the number spellings and hexadecimal/separator meanings; the separately installed legacy parser and JavaScript evaluator check syntax and value without asking the factory to compute an expectation.
 * @evidence contracts/testing.md#distinguishing-cases Zero is the empty-looking numeric boundary; integer, fractional and exponent numbers contrast hexadecimal and separated decimal strings whose text must remain intact. The existing numeric_literal case retains its ordinary string controls.
 * @evidence contracts/testing.md#execution-ownership The matching src/features/literals export runs under the factory source-unit runner and central function claim. It calls authored factory/printer operations and the legacy parser in the same Node process; no compiler CLI, native build, consumer installation or product host executes.
 */
export function test_numeric_literal_number_and_lexical_inputs(): void {
  for (const [input, text, value] of [
    [0, "0", 0],
    [42, "42", 42],
    [3.14, "3.14", 3.14],
    [1e21, "1e+21", 1e21],
    ["0xff", "0xff", 255],
    ["1_000", "1_000", 1000],
  ] as const) {
    const output = print(factory.createNumericLiteral(input));
    assert.equal(output, text);
    const parsed = ts.createSourceFile(
      "literal.ts",
      output,
      ts.ScriptTarget.Latest,
    );
    assert.deepEqual(
      (
        parsed as ts.SourceFile & {
          parseDiagnostics: readonly ts.Diagnostic[];
        }
      ).parseDiagnostics,
      [],
      text,
    );
    assert.equal(new Function(`return (${output});`)(), value, text);
  }
}
