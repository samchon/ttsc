import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { num, print } from "../../internal/helpers";

/**
 * Print {@link factory.createNumericLiteral|numeric literals}.
 *
 * Both string and number inputs render to their textual form.
 */
export const test_numeric_literal = (): void => {
  TestValidator.equals("string", print(num("42")), "42");
  TestValidator.equals(
    "number",
    print(factory.createNumericLiteral(String(3.14))),
    "3.14",
  );
};
