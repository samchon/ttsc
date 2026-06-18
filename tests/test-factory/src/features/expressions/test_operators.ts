import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print binary, unary, and conditional operators.
 *
 * Binary `+` and `===`, prefix `!`, postfix `++`, and the `c ? a : b` ternary,
 * all on a single line when they fit.
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
