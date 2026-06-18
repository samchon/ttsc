import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, mod, num, print } from "../../internal/helpers";

/**
 * Print a generic type alias and an enum.
 *
 * `export type ID<T> = string | number;` and an enum whose members break one
 * per line with a trailing comma.
 */
export const test_type_alias_and_enum = (): void => {
  TestValidator.equals(
    "type alias",
    print(
      factory.createTypeAliasDeclaration(
        [mod(SyntaxKind.ExportKeyword)],
        "ID",
        [factory.createTypeParameterDeclaration(undefined, "T")],
        factory.createUnionTypeNode([
          kw(SyntaxKind.StringKeyword),
          kw(SyntaxKind.NumberKeyword),
        ]),
      ),
    ),
    "export type ID<T> = string | number;",
  );
  TestValidator.equals(
    "enum",
    print(
      factory.createEnumDeclaration(undefined, "Color", [
        factory.createEnumMember("Red", num("0")),
        factory.createEnumMember("Green"),
      ]),
    ),
    ["enum Color {", "  Red = 0,", "  Green,", "}"].join("\n"),
  );
};
