import { TestValidator } from "@nestia/e2e";
import factory, { TsPrinter } from "../../../../../packages/factory/src/index";

import { num } from "../../internal/helpers";

/**
 * Verifies arrays and objects break by width alone (no `multiLine` flag).
 *
 * Under a very small `printWidth`, even a short array or single-property object
 * is forced to break.
 *
 * 1. Small width alone forces arrays and objects into their expected multiline layouts.
 * 2. Explicit broken source lines independently fix elements, properties, commas and indentation.
 *
 * @evidence contracts/testing.md#behavioral-verification Small width alone forces arrays and objects into their expected multiline layouts.
 * @evidence contracts/testing.md#independent-expectations Explicit broken source lines independently fix elements, properties, commas and indentation.
 * @evidence contracts/testing.md#distinguishing-cases Three-element array versus singleton object under width5 complements default flat array/object tests.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_array_object_breaks. Calls TsPrinter.print with printWidth 5 on authored array and object nodes.
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
