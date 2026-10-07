import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, print, ref } from "../../internal/helpers";

/**
 * Verifies assertion expression parenthesizer: preserves `as` and `satisfies`
 * boundaries.
 *
 * `as` and `satisfies` live at relational precedence. They can be operands of
 * other binary expressions, but lower-precedence parents and tighter child
 * contexts must not absorb their inner expression.
 *
 * 1. Print assertion expressions as operands of arithmetic and relational
 *    binaries.
 * 2. Print a binary expression under an assertion before multiplication.
 * 3. Assert the emitted parentheses preserve the assertion boundary.
 *
 * @evidence contracts/testing.md#behavioral-verification As/satisfies operands retain grouping under arithmetic and relational operators.
 * @evidence contracts/testing.md#independent-expectations Exact assertion/binary source literals are independent expectations based on TypeScript operator binding.
 * @evidence contracts/testing.md#distinguishing-cases Assertion as binary operand versus arithmetic inside an assertion, and as versus satisfies, pin separate parenthesizer directions.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_assertion_expression_parentheses. Calls createAsExpression/createSatisfiesExpression/createBinaryExpression and prints authored trees.
 */
export const test_assertion_expression_parentheses = (): void => {
  TestValidator.equals(
    "as expression left arithmetic operand",
    print(
      factory.createAdd(factory.createAsExpression(id("a"), ref("T")), id("b")),
    ),
    "(a as T) + b",
  );
  TestValidator.equals(
    "as expression right relational operand",
    print(
      factory.createBinaryExpression(
        id("x"),
        SyntaxKind.LessThanToken,
        factory.createAsExpression(id("y"), ref("T")),
      ),
    ),
    "x < (y as T)",
  );
  TestValidator.equals(
    "satisfies expression right relational operand",
    print(
      factory.createBinaryExpression(
        id("x"),
        SyntaxKind.LessThanToken,
        factory.createSatisfiesExpression(id("y"), ref("T")),
      ),
    ),
    "x < (y satisfies T)",
  );
  TestValidator.equals(
    "asserted binary left multiplicative operand",
    print(
      factory.createMultiply(
        factory.createAsExpression(
          factory.createAdd(id("a"), id("b")),
          ref("T"),
        ),
        id("c"),
      ),
    ),
    "(a + b as T) * c",
  );
};
