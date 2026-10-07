import { TestValidator } from "@nestia/e2e";

import factory, { TsPrinter } from "../../../../../packages/factory/src/index";
import { id } from "../../internal/helpers";

/**
 * Verifies a call wider than `printWidth` breaks one argument per line.
 *
 * With `printWidth: 10`, `foo(a, b, c)` no longer fits, so the printer breaks
 * it and adds a trailing comma.
 *
 * 1. A width10 call breaks its a/b/c arguments onto separate lines with a final
 *    comma.
 * 2. Explicit foo multiline source independently fixes argument order and trailing
 *    comma policy.
 *
 * @evidence contracts/testing.md#behavioral-verification A width10 call breaks its a/b/c arguments onto separate lines with a final comma.
 * @evidence contracts/testing.md#independent-expectations Explicit foo multiline source independently fixes argument order and trailing comma policy.
 * @evidence contracts/testing.md#distinguishing-cases Three arguments exceeding width contrast with the short call_expression case; type arguments have a no-trailing-comma rule.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_call_breaks. Calls createCallExpression then TsPrinter.print with printWidth 10.
 */
export const test_call_breaks = (): void => {
  const tiny = new TsPrinter({ printWidth: 10 });
  TestValidator.equals(
    "call break",
    tiny.print(
      factory.createCallExpression(id("foo"), undefined, [
        id("a"),
        id("b"),
        id("c"),
      ]),
    ),
    ["foo(", "  a,", "  b,", "  c,", ")"].join("\n"),
  );
};
