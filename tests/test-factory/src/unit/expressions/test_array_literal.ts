import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { num, print } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createArrayLiteralExpression|array literals}.
 *
 * Empty arrays render as `[]`, short arrays inline, and the `multiLine` flag
 * forces one element per line with a trailing comma.
 *
 * 1. Empty, inline two-element and explicitly multiline arrays preserve brackets, elements and requested layout.
 * 2. Literal [], [1, 2] and explicit broken-array lines specify output independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Empty, inline two-element and explicitly multiline arrays preserve brackets, elements and requested layout.
 * @evidence contracts/testing.md#independent-expectations Literal [], [1, 2] and explicit broken-array lines specify output independently.
 * @evidence contracts/testing.md#distinguishing-cases Empty versus two elements and omitted versus true multiline flags expose list and layout branches; trailing holes have dedicated width tests.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_array_literal. Calls createArrayLiteralExpression and the default TsPrinter.print through print.
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
