import { TestValidator } from "@nestia/e2e";
import factory, { TsPrinter } from "../../../../../packages/factory/src/index";

import { num } from "../../internal/helpers";

/**
 * Verifies the `indent` option controls the indentation unit.
 *
 * With `indent: "    "` (four spaces) a broken array indents four spaces per level
 * instead of the default two.
 *
 * 1. A forced broken array uses four spaces for each configured indentation step.
 * 2. Explicit multiline array lines contain four spaces rather than the default two.
 *
 * @evidence contracts/testing.md#behavioral-verification A forced broken array uses four spaces for each configured indentation step.
 * @evidence contracts/testing.md#independent-expectations Explicit multiline array lines contain four spaces rather than the default two.
 * @evidence contracts/testing.md#distinguishing-cases The printWidth 1 case forces indentation to be observable; default two-space layout is covered by deep_nesting.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_indent_option. Constructs TsPrinter with indent four spaces and prints a two-element array directly.
 */
export const test_indent_option = (): void => {
  const four = new TsPrinter({ printWidth: 1, indent: "    " });
  TestValidator.equals(
    "4-space",
    four.print(factory.createArrayLiteralExpression([num("1"), num("2")])),
    ["[", "    1,", "    2,", "]"].join("\n"),
  );
};
