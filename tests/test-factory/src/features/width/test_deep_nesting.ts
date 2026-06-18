import { TestValidator } from "@nestia/e2e";
import factory, { TsPrinter } from "@ttsc/factory";

import { num } from "../../internal/helpers";

/**
 * A deeply nested structure indents consistently at every level.
 *
 * With `printWidth: 1` every group breaks, so an object → array → object chain
 * produces clean two-space steps — a stress test for the printer's
 * indentation.
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
