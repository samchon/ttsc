import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, kw, mod, printer } from "../../internal/helpers";

/**
 * Print a whole module via {@link TsPrinter.printFile}.
 *
 * An import plus an exported class with a private field and a public method —
 * an end-to-end check that statements, members, and blocks compose with correct
 * indentation and a trailing newline.
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
