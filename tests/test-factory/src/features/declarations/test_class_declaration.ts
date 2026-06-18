import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, kw, mod, param, print } from "../../internal/helpers";

/**
 * Print a rich {@link factory.createClassDeclaration|class declaration}.
 *
 * Exercises both heritage clauses (`extends` + `implements`), a modified
 * property, a constructor, a getter, and a decorated method — decorators sit on
 * their own line above the member.
 */
export const test_class_declaration = (): void => {
  TestValidator.equals(
    "class",
    print(
      factory.createClassDeclaration(
        [mod(SyntaxKind.ExportKeyword)],
        "Animal",
        undefined,
        [
          factory.createHeritageClause(SyntaxKind.ExtendsKeyword, [
            factory.createExpressionWithTypeArguments(id("Base"), undefined),
          ]),
          factory.createHeritageClause(SyntaxKind.ImplementsKeyword, [
            factory.createExpressionWithTypeArguments(id("Living"), undefined),
          ]),
        ],
        [
          factory.createPropertyDeclaration(
            [mod(SyntaxKind.PublicKeyword), mod(SyntaxKind.ReadonlyKeyword)],
            "name",
            undefined,
            kw(SyntaxKind.StringKeyword),
            undefined,
          ),
          factory.createConstructorDeclaration(
            undefined,
            [param("name", kw(SyntaxKind.StringKeyword))],
            factory.createBlock([], true),
          ),
          factory.createGetAccessorDeclaration(
            undefined,
            "label",
            [],
            kw(SyntaxKind.StringKeyword),
            factory.createBlock(
              [factory.createReturnStatement(factory.createThis())],
              true,
            ),
          ),
          factory.createMethodDeclaration(
            [factory.createDecorator(id("log"))],
            undefined,
            "cry",
            undefined,
            undefined,
            [],
            kw(SyntaxKind.VoidKeyword),
            factory.createBlock([], true),
          ),
        ],
      ),
    ),
    [
      "export class Animal extends Base implements Living {",
      "  public readonly name: string;",
      "  constructor(name: string) {}",
      "  get label(): string {",
      "    return this;",
      "  }",
      "  @log",
      "  cry(): void {}",
      "}",
    ].join("\n"),
  );
};
