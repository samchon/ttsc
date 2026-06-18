import { TestValidator } from "@nestia/e2e";
import factory, { TsPrinter } from "@ttsc/factory";

import { num } from "../../internal/helpers";

/**
 * The `indent` option controls the indentation unit.
 *
 * With `indent: " "` (four spaces) a broken array indents four spaces per level
 * instead of the default two.
 */
export const test_indent_option = (): void => {
  const four = new TsPrinter({ printWidth: 1, indent: "    " });
  TestValidator.equals(
    "4-space",
    four.print(factory.createArrayLiteralExpression([num("1"), num("2")])),
    ["[", "    1,", "    2,", "]"].join("\n"),
  );
};
