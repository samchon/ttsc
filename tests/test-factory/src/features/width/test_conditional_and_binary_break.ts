import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, TsPrinter } from "@ttsc/factory";

import { id } from "../../internal/helpers";

/**
 * Conditional and binary expressions break across lines.
 *
 * Forced with `printWidth: 1`: the ternary indents its branches and the binary
 * puts the right operand on the next line.
 */
export const test_conditional_and_binary_break = (): void => {
  const forced = new TsPrinter({ printWidth: 1 });
  TestValidator.equals(
    "conditional",
    forced.print(
      factory.createConditionalExpression(
        id("cond"),
        undefined,
        id("yes"),
        undefined,
        id("no"),
      ),
    ),
    ["cond", "  ? yes", "  : no"].join("\n"),
  );
  TestValidator.equals(
    "binary",
    forced.print(
      factory.createBinaryExpression(id("a"), SyntaxKind.PlusToken, id("b")),
    ),
    ["a +", "  b"].join("\n"),
  );
};
