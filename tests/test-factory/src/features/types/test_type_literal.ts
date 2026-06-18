import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, print } from "../../internal/helpers";

/**
 * Print an inline {@link factory.createTypeLiteralNode|object type}.
 *
 * A single-member type literal stays on one line as `{ x: number }`.
 */
export const test_type_literal = (): void => {
  TestValidator.equals(
    "inline",
    print(
      factory.createTypeLiteralNode([
        factory.createPropertySignature(
          undefined,
          "x",
          undefined,
          kw(SyntaxKind.NumberKeyword),
        ),
      ]),
    ),
    "{ x: number }",
  );
};
