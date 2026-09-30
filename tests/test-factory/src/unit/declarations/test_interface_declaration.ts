import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, kw, mod, param, print, ref } from "../../internal/helpers";

/**
 * Verifies printing of an {@link factory.createInterfaceDeclaration|interface}.
 *
 * Generic, extends a base, and carries a readonly property, an optional
 * property, a method signature, and an index signature — each member on its own
 * line.
 *
 * 1. The generic exported IBox printer preserves Base heritage and readonly/optional/method/index members.
 * 2. The complete literal interface body specifies each name, type, punctuation and indentation independently.
 *
 * @evidence contracts/testing.md#behavioral-verification The generic exported IBox printer preserves Base heritage and readonly/optional/method/index members.
 * @evidence contracts/testing.md#independent-expectations The complete literal interface body specifies each name, type, punctuation and indentation independently.
 * @evidence contracts/testing.md#distinguishing-cases Optional property, readonly property, callable member and index signature occupy distinct branches within one declaration.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_interface_declaration. Calls createInterfaceDeclaration and signature constructors followed by TsPrinter.print.
 */
export const test_interface_declaration = (): void => {
  TestValidator.equals(
    "interface",
    print(
      factory.createInterfaceDeclaration(
        [mod(SyntaxKind.ExportKeyword)],
        "IBox",
        [factory.createTypeParameterDeclaration(undefined, "T")],
        [
          factory.createHeritageClause(SyntaxKind.ExtendsKeyword, [
            factory.createExpressionWithTypeArguments(id("Base"), undefined),
          ]),
        ],
        [
          factory.createPropertySignature(
            [mod(SyntaxKind.ReadonlyKeyword)],
            "value",
            undefined,
            ref("T"),
          ),
          factory.createPropertySignature(
            undefined,
            "tag",
            factory.createToken(SyntaxKind.QuestionToken),
            kw(SyntaxKind.StringKeyword),
          ),
          factory.createMethodSignature(
            undefined,
            "map",
            undefined,
            undefined,
            [param("v", kw(SyntaxKind.NumberKeyword))],
            kw(SyntaxKind.VoidKeyword),
          ),
          factory.createIndexSignature(
            undefined,
            [param("key", kw(SyntaxKind.StringKeyword))],
            kw(SyntaxKind.NumberKeyword),
          ),
        ],
      ),
    ),
    [
      "export interface IBox<T> extends Base {",
      "  readonly value: T;",
      "  tag?: string;",
      "  map(v: number): void;",
      "  [key: string]: number;",
      "}",
    ].join("\n"),
  );
};
