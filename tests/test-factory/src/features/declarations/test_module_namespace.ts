import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags, SyntaxKind } from "@ttsc/factory";

import { id, mod, num, print } from "../../internal/helpers";

/**
 * Print namespace / module declarations and a class `static` block.
 *
 * An exported `namespace` with a body, an ambient `module "name"` with an empty
 * body, and a standalone `static { ... }` class initialization block.
 */
export const test_module_namespace = (): void => {
  const constX = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          id("x"),
          undefined,
          undefined,
          num("1"),
        ),
      ],
      NodeFlags.Const,
    ),
  );
  // No flag is the legacy `module A` form, which is what upstream emits for an
  // identifier name without `NodeFlags.Namespace`. `test_namespace_flag` covers
  // the flagged spelling.
  TestValidator.equals(
    "module keyword without the namespace flag",
    print(
      factory.createModuleDeclaration(
        [mod(SyntaxKind.ExportKeyword)],
        "App",
        factory.createModuleBlock([constX]),
      ),
    ),
    ["export module App {", "  const x = 1;", "}"].join("\n"),
  );
  TestValidator.equals(
    "module string name",
    print(
      factory.createModuleDeclaration(
        undefined,
        factory.createStringLiteral("mod"),
        factory.createModuleBlock([]),
      ),
    ),
    `module "mod" {}`,
  );
  TestValidator.equals(
    "static block",
    print(
      factory.createClassStaticBlockDeclaration(
        factory.createBlock(
          [
            factory.createExpressionStatement(
              factory.createCallExpression(id("init"), undefined, []),
            ),
          ],
          true,
        ),
      ),
    ),
    ["static {", "  init();", "}"].join("\n"),
  );
};
