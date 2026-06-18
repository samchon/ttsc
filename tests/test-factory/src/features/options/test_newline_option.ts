import { TestValidator } from "@nestia/e2e";
import factory, { TsPrinter } from "@ttsc/factory";

import { num } from "../../internal/helpers";

/**
 * The `newLine` option controls the line separator.
 *
 * With `newLine: "\r\n"` the broken output uses CRLF between lines.
 */
export const test_newline_option = (): void => {
  const crlf = new TsPrinter({ printWidth: 1, newLine: "\r\n" });
  TestValidator.equals(
    "crlf",
    crlf.print(factory.createArrayLiteralExpression([num("1"), num("2")])),
    ["[", "  1,", "  2,", "]"].join("\r\n"),
  );
};
