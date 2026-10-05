import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { kw, mod, num, print } from "../../internal/helpers";

/**
 * Verifies printing of a generic type alias and an enum.
 *
 * `export type ID<T> = string | number;` and an enum whose members break one
 * per line with a trailing comma.
 *
 * 1. The exported generic ID alias and Red/Green enum retain union types, explicit
 *    initializer and uninitialized member.
 * 2. Literal alias text and complete four-line enum output specify syntax and
 *    trailing-comma policy independently.
 *
 * @evidence contracts/testing.md#behavioral-verification The exported generic ID alias and Red/Green enum retain union types, explicit initializer and uninitialized member.
 * @evidence contracts/testing.md#independent-expectations Literal alias text and complete four-line enum output specify syntax and trailing-comma policy independently.
 * @evidence contracts/testing.md#distinguishing-cases Initialized Red versus bare Green exercises member distinction; the inline alias contrasts with width-driven union_break.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_type_alias_and_enum. Calls createTypeAliasDeclaration, createEnumDeclaration and TsPrinter.print in process.
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
