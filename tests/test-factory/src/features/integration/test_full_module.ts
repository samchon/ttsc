import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, kw, mod, printer } from "../../internal/helpers";

/**
 * Verifies printing of a whole module via {@link TsPrinter.printFile}.
 *
 * An import plus an exported class with a private field and a public method — a
 * source-unit check that statements, members, and blocks compose with correct
 * indentation and a trailing newline.
 *
 * 1. PrintFile retains the import and exported Point class with typed private
 *    field and returning method.
 * 2. The complete independent module literal fixes order, member syntax,
 *    indentation and final newline.
 *
 * @evidence contracts/testing.md#behavioral-verification printFile retains the import and exported Point class with typed private field and returning method.
 * @evidence contracts/testing.md#independent-expectations The complete independent module literal fixes order, member syntax, indentation and final newline.
 * @evidence contracts/testing.md#distinguishing-cases Cross-node module composition complements isolated declaration/import cases; both field and body-bearing method survive together.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_full_module. Builds authored import/class statements then calls TsPrinter.printFile in one source unit export.
 */
export const test_full_module = (): void => {
  const importDecl = factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      undefined,
      undefined,
      factory.createNamedImports([
        factory.createImportSpecifier(false, undefined, "Base"),
      ]),
    ),
    "./base",
  );
  const classDecl = factory.createClassDeclaration(
    [mod(SyntaxKind.ExportKeyword)],
    "Point",
    undefined,
    [
      factory.createHeritageClause(SyntaxKind.ExtendsKeyword, [
        factory.createExpressionWithTypeArguments(id("Base"), undefined),
      ]),
    ],
    [
      factory.createPropertyDeclaration(
        [mod(SyntaxKind.PrivateKeyword)],
        "value",
        undefined,
        kw(SyntaxKind.NumberKeyword),
        undefined,
      ),
      factory.createMethodDeclaration(
        [mod(SyntaxKind.PublicKeyword)],
        undefined,
        "getValue",
        undefined,
        undefined,
        [],
        kw(SyntaxKind.NumberKeyword),
        factory.createBlock(
          [
            factory.createReturnStatement(
              factory.createPropertyAccessExpression(
                factory.createThis(),
                "value",
              ),
            ),
          ],
          true,
        ),
      ),
    ],
  );
  TestValidator.equals(
    "module",
    printer.printFile(undefined, [importDecl, classDecl]),
    [
      'import { Base } from "./base";',
      "export class Point extends Base {",
      "  private value: number;",
      "  public getValue(): number {",
      "    return this.value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  );
};
