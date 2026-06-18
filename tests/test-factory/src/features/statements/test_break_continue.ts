import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print } from "../../internal/helpers";

/** Print `break` / `continue`, both bare and with a target label. */
export const test_break_continue = (): void => {
  TestValidator.equals(
    "break",
    print(factory.createBreakStatement()),
    "break;",
  );
  TestValidator.equals(
    "break label",
    print(factory.createBreakStatement("outer")),
    "break outer;",
  );
  TestValidator.equals(
    "continue",
    print(factory.createContinueStatement()),
    "continue;",
  );
  TestValidator.equals(
    "continue label",
    print(factory.createContinueStatement("outer")),
    "continue outer;",
  );
};
