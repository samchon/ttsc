import { TestValidator } from "@nestia/e2e";
import factory, { TsPrinter } from "@ttsc/factory";

import { id } from "../../internal/helpers";

/**
 * A call wider than `printWidth` breaks one argument per line.
 *
 * With `printWidth: 10`, `foo(a, b, c)` no longer fits, so the printer breaks
 * it and adds a trailing comma.
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
