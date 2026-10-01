import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { kw, print, ref } from "../../internal/helpers";

/**
 * Verifies printing of type references and array types.
 *
 * A bare reference `Foo`, a generic `Map<string, number>`, and an array type
 * `string[]`.
 *
 * 1. Bare Foo, generic Map<string, number> and string[] retain type arguments and postfix array syntax.
 * 2. Exact literal type sources independently specify names, argument order and brackets.
 *
 * @evidence contracts/testing.md#behavioral-verification Bare Foo, generic Map<string, number> and string[] retain type arguments and postfix array syntax.
 * @evidence contracts/testing.md#independent-expectations Exact literal type sources independently specify names, argument order and brackets.
 * @evidence contracts/testing.md#distinguishing-cases Absent versus two type arguments and array wrapper distinguish reference-list and postfix branches.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_reference_and_array. Calls createTypeReferenceNode/createArrayTypeNode and TsPrinter.print through ref/kw helpers.
 */
export const test_reference_and_array = (): void => {
  TestValidator.equals("ref", print(ref("Foo")), "Foo");
  TestValidator.equals(
    "generic",
    print(
      factory.createTypeReferenceNode("Map", [
        kw(SyntaxKind.StringKeyword),
        kw(SyntaxKind.NumberKeyword),
      ]),
    ),
    "Map<string, number>",
  );
  TestValidator.equals(
    "array",
    print(factory.createArrayTypeNode(kw(SyntaxKind.StringKeyword))),
    "string[]",
  );
};
