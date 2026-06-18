import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print, str } from "../../internal/helpers";

/**
 * Print {@link factory.createLiteralTypeNode|literal types}.
 *
 * A string literal type `"red"` and a boolean literal type `true`.
 */
export const test_literal_type = (): void => {
  TestValidator.equals(
    "string",
    print(factory.createLiteralTypeNode(str("red"))),
    '"red"',
  );
  TestValidator.equals(
    "true",
    print(factory.createLiteralTypeNode(factory.createTrue())),
    "true",
  );
};
