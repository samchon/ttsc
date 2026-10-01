import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { id, num, print } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createIfStatement|if} / `else` and blocks.
 *
 * An empty block `{}`, an `if (cond) { ... }`, and a full `if/else` whose
 * branch blocks always break onto their own lines.
 *
 * 1. Empty blocks, if-then and if-else preserve braces, condition and branch association.
 * 2. Literal block and complete if sources independently fix delimiters and else placement.
 *
 * @evidence contracts/testing.md#behavioral-verification Empty blocks, if-then and if-else preserve braces, condition and branch association.
 * @evidence contracts/testing.md#independent-expectations Literal block and complete if sources independently fix delimiters and else placement.
 * @evidence contracts/testing.md#distinguishing-cases Empty block, absent else and present else distinguish optional branch handling.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_if_and_block. Calls createBlock/createIfStatement and TsPrinter.print directly.
 */
export const test_if_and_block = (): void => {
  TestValidator.equals("empty block", print(factory.createBlock([])), "{}");
  TestValidator.equals(
    "if then",
    print(
      factory.createIfStatement(
        id("cond"),
        factory.createBlock([factory.createReturnStatement()], true),
      ),
    ),
    ["if (cond) {", "  return;", "}"].join("\n"),
  );
  TestValidator.equals(
    "if else",
    print(
      factory.createIfStatement(
        id("cond"),
        factory.createBlock([factory.createReturnStatement(num("1"))], true),
        factory.createBlock([factory.createReturnStatement(num("2"))], true),
      ),
    ),
    ["if (cond) {", "  return 1;", "} else {", "  return 2;", "}"].join("\n"),
  );
};
