import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, num, print } from "../../internal/helpers";

/**
 * Print {@link factory.createObjectLiteralExpression|object literals}.
 *
 * Covers property assignments, shorthand members, and spread members. The
 * `multiLine` flag breaks the object with trailing commas and two-space
 * indent.
 */
export const test_object_literal = (): void => {
  TestValidator.equals(
    "empty",
    print(factory.createObjectLiteralExpression([])),
    "{}",
  );
  TestValidator.equals(
    "inline",
    print(
      factory.createObjectLiteralExpression([
        factory.createPropertyAssignment("a", num("1")),
      ]),
    ),
    "{ a: 1 }",
  );
  TestValidator.equals(
    "multiline",
    print(
      factory.createObjectLiteralExpression(
        [
          factory.createPropertyAssignment("a", num("1")),
          factory.createShorthandPropertyAssignment("b"),
          factory.createSpreadAssignment(id("rest")),
        ],
        true,
      ),
    ),
    ["{", "  a: 1,", "  b,", "  ...rest,", "}"].join("\n"),
  );
};
