import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { num, print } from "../../internal/helpers";

/**
 * A negative numeric literal type, e.g. `type T = -1;`.
 *
 * `createLiteralTypeNode` accepts a {@link factory.createPrefixUnaryExpression}
 * so negative numbers can appear as literal types.
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
          factory.createPrefixUnaryExpression(
            SyntaxKind.MinusToken,
            num("1"),
          ),
        ),
      ),
    ),
    "type T = -1;",
  );
};
