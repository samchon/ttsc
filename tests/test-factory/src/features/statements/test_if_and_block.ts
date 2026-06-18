import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, num, print } from "../../internal/helpers";

/**
 * Print {@link factory.createIfStatement|if} / `else` and blocks.
 *
 * An empty block `{}`, an `if (cond) { ... }`, and a full `if/else` whose
 * branch blocks always break onto their own lines.
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
