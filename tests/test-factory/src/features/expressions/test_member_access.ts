import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of property and element access expressions.
 *
 * `a.b` for {@link factory.createPropertyAccessExpression|property access}, and
 * `a[0]` / `a[k]` for
 * {@link factory.createElementAccessExpression|element access} with numeric and
 * expression indices.
 *
 * 1. Property and element access preserve their receiver, dot or brackets and
 *    literal/identifier index.
 * 2. Literal a.b, a[0] and a[k] expectations independently encode the chosen
 *    access form.
 *
 * @evidence contracts/testing.md#behavioral-verification Property and element access preserve their receiver, dot or brackets and literal/identifier index.
 * @evidence contracts/testing.md#independent-expectations Literal a.b, a[0] and a[k] expectations independently encode the chosen access form.
 * @evidence contracts/testing.md#distinguishing-cases Property versus numeric/identifier element inputs distinguish punctuation and index handling; optional forms are covered by optional_chaining.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_member_access. Calls createPropertyAccessExpression/createElementAccessExpression and print directly.
 */
export const test_member_access = (): void => {
  TestValidator.equals(
    "property",
    print(factory.createPropertyAccessExpression(id("a"), "b")),
    "a.b",
  );
  TestValidator.equals(
    "element number",
    print(factory.createElementAccessExpression(id("a"), 0)),
    "a[0]",
  );
  TestValidator.equals(
    "element expr",
    print(factory.createElementAccessExpression(id("a"), id("k"))),
    "a[k]",
  );
};
