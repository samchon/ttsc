import { TestValidator } from "@nestia/e2e";

import factory, {
  SyntaxKind,
  TsPrinter,
} from "../../../../../packages/factory/src/index";
import { id } from "../../internal/helpers";

/**
 * Verifies conditional and binary expressions break across lines.
 *
 * Forced with `printWidth: 1`: the ternary indents its branches and the binary
 * puts the right operand on the next line.
 *
 * 1. Forced-width conditional branches and binary RHS break with their prescribed
 *    indentation and operator position.
 * 2. Independent multiline source arrays specify ?/: and + placement, not another
 *    layout run.
 *
 * @evidence contracts/testing.md#behavioral-verification Forced-width conditional branches and binary RHS break with their prescribed indentation and operator position.
 * @evidence contracts/testing.md#independent-expectations Independent multiline source arrays specify ?/: and + placement, not another layout run.
 * @evidence contracts/testing.md#distinguishing-cases Two distinct expression kinds at width1 distinguish ternary branch layout from binary RHS layout.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_conditional_and_binary_break. Calls createConditionalExpression/createBinaryExpression and the printWidth 1 TsPrinter.
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
