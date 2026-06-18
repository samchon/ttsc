import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

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
