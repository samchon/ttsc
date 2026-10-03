import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { num, print } from "../../internal/helpers";

/**
 * Verifies a negative numeric literal type, e.g. `type T = -1;`.
 *
 * `createLiteralTypeNode` accepts a {@link factory.createPrefixUnaryExpression}
 * so negative numbers can appear as literal types.
 *
 * 1. A negative numeric literal type preserves the minus operator inside a T alias.
 * 2. Literal type T = -1; independently requires a numeric literal with unary minus, not a positive or string value.
 *
 * @evidence contracts/testing.md#behavioral-verification A negative numeric literal type preserves the minus operator inside a T alias.
 * @evidence contracts/testing.md#independent-expectations Literal type T = -1; independently requires a numeric literal with unary minus, not a positive or string value.
 * @evidence contracts/testing.md#distinguishing-cases This unary literal boundary complements ordinary string/boolean literal types and textual positive numeric literals.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_negative_literal_type. Calls createPrefixUnaryExpression/createLiteralTypeNode/createTypeAliasDeclaration and print.
 */
export const test_negative_literal_type = (): void => {
  TestValidator.equals(
    "negative literal type",
    print(
      factory.createTypeAliasDeclaration(
        undefined,
        "T",
        undefined,
        factory.createLiteralTypeNode(
          factory.createPrefixUnaryExpression(SyntaxKind.MinusToken, num("1")),
        ),
      ),
    ),
    "type T = -1;",
  );
};
