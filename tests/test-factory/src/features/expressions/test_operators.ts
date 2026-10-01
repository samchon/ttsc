import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of binary, unary, and conditional operators.
 *
 * Binary `+` and `===`, prefix `!`, postfix `++`, and the `c ? a : b` ternary,
 * all on a single line when they fit.
 *
 * 1. Representative binary, unary, postfix and conditional expressions retain their chosen operators and operands.
 * 2. Literal a + b, equality, !f, i++ and ternary expectations come from syntax rather than token lookup in the printer.
 *
 * @evidence contracts/testing.md#behavioral-verification Representative binary, unary, postfix and conditional expressions retain their chosen operators and operands.
 * @evidence contracts/testing.md#independent-expectations Literal a + b, equality, !f, i++ and ternary expectations come from syntax rather than token lookup in the printer.
 * @evidence contracts/testing.md#distinguishing-cases Operator families with distinct node forms complement the exhaustive convenience-alias table.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_operators. Calls binary/prefix/postfix/conditional factory constructors and print directly.
 */
export const test_operators = (): void => {
  TestValidator.equals(
    "binary +",
    print(
      factory.createBinaryExpression(id("a"), SyntaxKind.PlusToken, id("b")),
    ),
    "a + b",
  );
  TestValidator.equals(
    "binary ===",
    print(
      factory.createBinaryExpression(
        id("a"),
        SyntaxKind.EqualsEqualsEqualsToken,
        id("b"),
      ),
    ),
    "a === b",
  );
  TestValidator.equals(
    "prefix",
    print(
      factory.createPrefixUnaryExpression(SyntaxKind.ExclamationToken, id("f")),
    ),
    "!f",
  );
  TestValidator.equals(
    "postfix",
    print(
      factory.createPostfixUnaryExpression(id("i"), SyntaxKind.PlusPlusToken),
    ),
    "i++",
  );
  TestValidator.equals(
    "conditional",
    print(
      factory.createConditionalExpression(
        id("c"),
        undefined,
        id("a"),
        undefined,
        id("b"),
      ),
    ),
    "c ? a : b",
  );
};
