import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print a {@link factory.createQualifiedName|qualified (dotted) name}.
 *
 * Qualified names nest on the left, so a two-level name renders as `ns.Type`
 * and a recursively built one as `a.b.c`.
 */
export const test_qualified_name = (): void => {
  TestValidator.equals(
    "two",
    print(factory.createQualifiedName(id("ns"), "Type")),
    "ns.Type",
  );
  TestValidator.equals(
    "three",
    print(
      factory.createQualifiedName(
        factory.createQualifiedName(id("a"), "b"),
        "c",
      ),
    ),
    "a.b.c",
  );
};
