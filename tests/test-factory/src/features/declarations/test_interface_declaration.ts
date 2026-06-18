import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, kw, mod, param, print, ref } from "../../internal/helpers";

/**
 * Print an {@link factory.createInterfaceDeclaration|interface}.
 *
 * Generic, extends a base, and carries a readonly property, an optional
 * property, a method signature, and an index signature — each member on its own
 * line.
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
