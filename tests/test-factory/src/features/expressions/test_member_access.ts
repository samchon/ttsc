import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print property and element access expressions.
 *
 * `a.b` for {@link factory.createPropertyAccessExpression|property access}, and
 * `a[0]` / `a[k]` for
 * {@link factory.createElementAccessExpression|element access} with numeric and
 * expression indices.
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
