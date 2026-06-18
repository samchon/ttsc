import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, num, print } from "../../internal/helpers";

/**
 * Print {@link factory.createNewExpression|constructor calls}.
 *
 * With and without arguments — `new Foo(1)` and `new Foo()` (a `undefined`
 * argument list is treated as empty).
 */
export const test_new_expression = (): void => {
  TestValidator.equals(
    "args",
    print(factory.createNewExpression(id("Foo"), undefined, [num("1")])),
    "new Foo(1)",
  );
  TestValidator.equals(
    "no args",
    print(factory.createNewExpression(id("Foo"), undefined, undefined)),
    "new Foo()",
  );
};
