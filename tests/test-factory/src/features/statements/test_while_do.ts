import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/** Print `while` and `do...while` loops with empty bodies. */
export const test_while_do = (): void => {
  TestValidator.equals(
    "while",
    print(
      factory.createWhileStatement(id("ok"), factory.createBlock([], true)),
    ),
    "while (ok) {}",
  );
  TestValidator.equals(
    "do-while",
    print(factory.createDoStatement(factory.createBlock([], true), id("ok"))),
    "do {} while (ok);",
  );
};
