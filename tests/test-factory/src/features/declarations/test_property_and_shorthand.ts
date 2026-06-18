import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, num, print } from "../../internal/helpers";

/**
 * Print an optional class property and a shorthand assignment.
 *
 * `x?: number;` for a {@link factory.createPropertyDeclaration|property} and `x
 * = 1` for a {@link factory.createShorthandPropertyAssignment|shorthand}.
 */
export const test_property_and_shorthand = (): void => {
  TestValidator.equals(
    "optional property",
    print(
      factory.createPropertyDeclaration(
        undefined,
        "x",
        factory.createToken(SyntaxKind.QuestionToken),
        kw(SyntaxKind.NumberKeyword),
        undefined,
      ),
    ),
    "x?: number;",
  );
  TestValidator.equals(
    "shorthand initializer",
    print(factory.createShorthandPropertyAssignment("x", num("1"))),
    "x = 1",
  );
};
