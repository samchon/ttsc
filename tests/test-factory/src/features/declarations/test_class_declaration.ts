import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, kw, mod, param, print } from "../../internal/helpers";

/**
 * Verifies printing of a rich {@link factory.createClassDeclaration|class declaration}.
 *
 * Exercises both heritage clauses (`extends` + `implements`), a modified
 * property, a constructor, a getter, and a decorated method — decorators sit on
 * their own line above the member.
 *
 * 1. The exported class printer preserves heritage, modifiers, constructor, getter, decorated method and their nested layout.
 * 2. The complete Animal class literal independently specifies each supplied member and its public/readonly and decorator tokens.
 *
 * @evidence contracts/testing.md#behavioral-verification The exported class printer preserves heritage, modifiers, constructor, getter, decorated method and their nested layout.
 * @evidence contracts/testing.md#independent-expectations The complete Animal class literal independently specifies each supplied member and its public/readonly and decorator tokens.
 * @evidence contracts/testing.md#distinguishing-cases The heterogeneous member list covers body-bearing constructor/method versus property declarations; class_expression covers the separate expression form.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_class_declaration. Calls createClassDeclaration and member constructors then TsPrinter.print on authored factory nodes.
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
