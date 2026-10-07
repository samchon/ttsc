import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of a
 * {@link factory.createQualifiedName|qualified (dotted) name}.
 *
 * Qualified names nest on the left, so a two-level name renders as `ns.Type`
 * and a recursively built one as `a.b.c`.
 *
 * 1. Qualified type names print ns.Type and the nested a.b.c chain without
 *    dropping separators or order.
 * 2. Literal qualified names independently specify the supplied identifiers and
 *    dots.
 *
 * @evidence contracts/testing.md#behavioral-verification Qualified type names print ns.Type and the nested a.b.c chain without dropping separators or order.
 * @evidence contracts/testing.md#independent-expectations Literal qualified names independently specify the supplied identifiers and dots.
 * @evidence contracts/testing.md#distinguishing-cases One qualification versus nested qualification distinguishes only handling the outermost pair.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_qualified_name. Calls createQualifiedName with identifier and qualified-name operands then TsPrinter.print.
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
