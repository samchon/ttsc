import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { num, print } from "../../internal/helpers";

/**
 * Print {@link factory.createArrayLiteralExpression|array literals}.
 *
 * Empty arrays render as `[]`, short arrays inline, and the `multiLine` flag
 * forces one element per line with a trailing comma.
 */
export const test_array_literal = (): void => {
  TestValidator.equals(
    "empty",
    print(factory.createArrayLiteralExpression([])),
    "[]",
  );
  TestValidator.equals(
    "inline",
    print(factory.createArrayLiteralExpression([num("1"), num("2")])),
    "[1, 2]",
  );
  TestValidator.equals(
    "multiline",
    print(factory.createArrayLiteralExpression([num("1"), num("2")], true)),
    ["[", "  1,", "  2,", "]"].join("\n"),
  );
};
