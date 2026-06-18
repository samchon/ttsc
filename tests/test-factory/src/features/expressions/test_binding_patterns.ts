import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { num, print } from "../../internal/helpers";

/**
 * Print destructuring binding patterns.
 *
 * An object pattern with a renamed and a rest element, and an array pattern
 * with a default, an elision (hole), and a rest element.
 */
export const test_binding_patterns = (): void => {
  TestValidator.equals(
    "object pattern",
    print(
      factory.createObjectBindingPattern([
        factory.createBindingElement(undefined, undefined, "a", undefined),
        factory.createBindingElement(undefined, "b", "c", undefined),
        factory.createBindingElement(
          factory.createToken(SyntaxKind.DotDotDotToken),
          undefined,
          "rest",
          undefined,
        ),
      ]),
    ),
    "{ a, b: c, ...rest }",
  );
  TestValidator.equals(
    "array pattern",
    print(
      factory.createArrayBindingPattern([
        factory.createBindingElement(undefined, undefined, "a", num("1")),
        factory.createOmittedExpression(),
        factory.createBindingElement(
          factory.createToken(SyntaxKind.DotDotDotToken),
          undefined,
          "rest",
          undefined,
        ),
      ]),
    ),
    "[a = 1, , ...rest]",
  );
};
