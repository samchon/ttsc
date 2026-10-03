import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies the comma operator is written the way every other producer writes
 * it.
 *
 * The printer surrounded every binary operator with a single space, which is
 * right for `+` and wrong for `,`: a comma is punctuation that attaches to what
 * precedes it. `createCommaListExpression` joins with `", "`, the legacy
 * printer and the repository's pinned Prettier both emit `a, b`, and
 * `createComma`'s own JSDoc example shows `(a, b)`. Only the printer
 * disagreed.
 *
 * `@ttsc/factory` exists to keep `ts.factory`-based generation working after
 * the tsgo migration, so generated text that no other producer emits is a
 * defect in the drop-in promise rather than a style preference.
 *
 * 1. Print a comma expression on its own and nested.
 * 2. Assert both spell it `a, b`.
 * 3. Assert the comma-list form, which was already correct, still agrees.
 *
 * @evidence contracts/testing.md#behavioral-verification Comma operators attach to their left operand and preserve nested list order without a leading space.
 * @evidence contracts/testing.md#independent-expectations Literal a, b and nested comma expectations specify separator bytes independently, with ordinary plus as a control.
 * @evidence contracts/testing.md#distinguishing-cases Binary comma, comma-list and nested forms contrast with a + b, catching accidental removal of normal operator spacing.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_comma_operator_attaches_to_the_left_operand. Calls createComma (flat and nested), createCommaListExpression and createBinaryExpression with a plus token, printing each through TsPrinter.print.
 */
export const test_comma_operator_attaches_to_the_left_operand = (): void => {
  TestValidator.equals(
    "comma operator",
    print(factory.createComma(id("a"), id("b"))),
    "a, b",
  );
  TestValidator.equals(
    "nested comma operator",
    print(factory.createComma(factory.createComma(id("a"), id("b")), id("c"))),
    "a, b, c",
  );
  TestValidator.equals(
    "comma list, unchanged",
    print(factory.createCommaListExpression([id("a"), id("b")])),
    "a, b",
  );
  // A binary operator that is not a comma keeps its surrounding spaces.
  TestValidator.equals(
    "ordinary binary operator",
    print(
      factory.createBinaryExpression(id("a"), SyntaxKind.PlusToken, id("b")),
    ),
    "a + b",
  );
};
