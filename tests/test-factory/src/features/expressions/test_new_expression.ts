import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, num, print } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createNewExpression|constructor calls}.
 *
 * With and without arguments — `new Foo(1)` and `new Foo()` (a `undefined`
 * argument list is treated as empty).
 *
 * 1. New expressions preserve constructor/argument syntax, normalizing absent
 *    arguments to an empty call list.
 * 2. Literal new Foo(1) and new Foo() specify the supported factory printer form
 *    independently.
 *
 * @evidence contracts/testing.md#behavioral-verification New expressions preserve constructor/argument syntax, normalizing absent arguments to an empty call list.
 * @evidence contracts/testing.md#independent-expectations Literal new Foo(1) and new Foo() specify the supported factory printer form independently.
 * @evidence contracts/testing.md#distinguishing-cases One supplied argument versus undefined arguments distinguishes argument list presence and normalization.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_new_expression. Calls createNewExpression and print with populated and absent argument arrays.
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
