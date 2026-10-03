import { TestValidator } from "@nestia/e2e";
import factory, { TsPrinter } from "../../../../../packages/factory/src/index";

import { num } from "../../internal/helpers";

/**
 * Verifies a deeply nested structure indents consistently at every level.
 *
 * With `printWidth: 1` every group breaks, so an object → array → object chain
 * produces clean two-space steps — a stress test for the printer's
 * indentation.
 *
 * 1. Broken object-array-object nesting increases indentation consistently at each level.
 * 2. Explicit multiline lines independently specify two-space indentation steps, property identity and separators.
 *
 * @evidence contracts/testing.md#behavioral-verification Broken object-array-object nesting increases indentation consistently at each level.
 * @evidence contracts/testing.md#independent-expectations Explicit multiline lines independently specify two-space indentation steps, property identity and separators.
 * @evidence contracts/testing.md#distinguishing-cases Three nested group levels forced at width1 expose accumulated indentation; custom four-space behavior belongs to indent_option.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_deep_nesting. Calls createObjectLiteralExpression/createArrayLiteralExpression and TsPrinter.print on the complete nested fixture.
 */
export const test_deep_nesting = (): void => {
  const forced = new TsPrinter({ printWidth: 1 });
  const node = factory.createObjectLiteralExpression([
    factory.createPropertyAssignment(
      "items",
      factory.createArrayLiteralExpression([
        factory.createObjectLiteralExpression([
          factory.createPropertyAssignment("id", num("1")),
        ]),
      ]),
    ),
  ]);
  TestValidator.equals(
    "deep nest",
    forced.print(node),
    ["{", "  items: [", "    {", "      id: 1,", "    },", "  ],", "}"].join(
      "\n",
    ),
  );
};
