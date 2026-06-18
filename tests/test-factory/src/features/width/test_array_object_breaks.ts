import { TestValidator } from "@nestia/e2e";
import factory, { TsPrinter } from "@ttsc/factory";

import { num } from "../../internal/helpers";

/**
 * Arrays and objects break by width alone (no `multiLine` flag).
 *
 * Under a very small `printWidth`, even a short array or single-property object
 * is forced to break.
 */
export const test_array_object_breaks = (): void => {
  const tiny = new TsPrinter({ printWidth: 5 });
  TestValidator.equals(
    "array",
    tiny.print(
      factory.createArrayLiteralExpression([num("1"), num("2"), num("3")]),
    ),
    ["[", "  1,", "  2,", "  3,", "]"].join("\n"),
  );
  TestValidator.equals(
    "object",
    tiny.print(
      factory.createObjectLiteralExpression([
        factory.createPropertyAssignment("a", num("1")),
      ]),
    ),
    ["{", "  a: 1,", "}"].join("\n"),
  );
};
