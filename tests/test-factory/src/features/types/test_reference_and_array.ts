import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, print, ref } from "../../internal/helpers";

/**
 * Print type references and array types.
 *
 * A bare reference `Foo`, a generic `Map<string, number>`, and an array type
 * `string[]`.
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
