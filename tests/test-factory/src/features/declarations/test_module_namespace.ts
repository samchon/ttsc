import { TestValidator } from "@nestia/e2e";

import factory, {
  NodeFlags,
  SyntaxKind,
} from "../../../../../packages/factory/src/index";
import { id, mod, num, print } from "../../internal/helpers";

/**
 * Verifies printing of namespace / module declarations and a class `static`
 * block.
 *
 * An exported identifier `module` with a body, a string-named module with an
 * empty body, and a standalone `static { ... }` class initialization block.
 *
 * 1. Module declarations print module without the namespace flag, including
 *    string-named modules and a static class block.
 * 2. Explicit export module App, module "mod" and static block literals specify
 *    the supplied forms.
 *
 * @evidence contracts/testing.md#behavioral-verification Module declarations print module without the namespace flag, including string-named modules and a static class block.
 * @evidence contracts/testing.md#independent-expectations Explicit export module App, module "mod" and static block literals specify the supplied forms.
 * @evidence contracts/testing.md#distinguishing-cases Identifier versus string module name and populated versus empty blocks complement namespace_flag.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_module_namespace. Calls createModuleDeclaration, createModuleBlock and createClassStaticBlockDeclaration, then TsPrinter.print.
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
