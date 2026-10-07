import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, num, print } from "../../internal/helpers";

/**
 * Verifies printing of
 * {@link factory.createObjectLiteralExpression|object literals}.
 *
 * Covers property assignments, shorthand members, and spread members. The
 * `multiLine` flag breaks the object with trailing commas and two-space
 * indent.
 *
 * 1. Empty, short and explicitly multiline object literals retain properties,
 *    shorthand and spread entries.
 * 2. The explicit object-source literals independently define braces, commas,
 *    indentation and property syntax.
 *
 * @evidence contracts/testing.md#behavioral-verification Empty, short and explicitly multiline object literals retain properties, shorthand and spread entries.
 * @evidence contracts/testing.md#independent-expectations The explicit object-source literals independently define braces, commas, indentation and property syntax.
 * @evidence contracts/testing.md#distinguishing-cases Empty/nonempty and omitted/true multiline flags complement forced-width object breaks and destructuring target cases.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_object_literal. Calls createObjectLiteralExpression with property/shorthand/spread nodes and print.
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
