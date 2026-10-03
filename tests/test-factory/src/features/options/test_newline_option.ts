import { TestValidator } from "@nestia/e2e";
import factory, { TsPrinter } from "../../../../../packages/factory/src/index";

import { num } from "../../internal/helpers";

/**
 * Verifies the `newLine` option controls the line separator.
 *
 * With `newLine: "\r\n"` the broken output uses CRLF between lines.
 *
 * 1. A forced array break uses CRLF at every line boundary.
 * 2. The expectation explicitly joins source lines with CRLF, independently of the printer option.
 *
 * @evidence contracts/testing.md#behavioral-verification A forced array break uses CRLF at every line boundary.
 * @evidence contracts/testing.md#independent-expectations The expectation explicitly joins source lines with CRLF, independently of the printer option.
 * @evidence contracts/testing.md#distinguishing-cases Forced layout exposes newline choice; default LF cases throughout width tests are the complementary control.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_newline_option. Calls TsPrinter.print with newLine CRLF and printWidth 1 on authored array nodes.
 */
export const test_newline_option = (): void => {
  const crlf = new TsPrinter({ printWidth: 1, newLine: "\r\n" });
  TestValidator.equals(
    "crlf",
    crlf.print(factory.createArrayLiteralExpression([num("1"), num("2")])),
    ["[", "  1,", "  2,", "]"].join("\r\n"),
  );
};
