import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags, SyntaxKind } from "@ttsc/factory";

import { id, mod, num, print } from "../../internal/helpers";

/**
 * The `NodeFlags.Namespace` flag is accepted on a module declaration.
 *
 * The printer renders the `namespace` keyword from the identifier name, so the
 * flag is cosmetic — but it must be a valid `NodeFlags` member for codegen
 * callers that pass it (e.g. `@nestia/migrate`).
 */
export const test_namespace_flag = (): void => {
  const constX = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [factory.createVariableDeclaration(id("x"), undefined, undefined, num("1"))],
      NodeFlags.Const,
    ),
  );
  TestValidator.equals(
    "namespace with explicit flag",
    print(
      factory.createModuleDeclaration(
        [mod(SyntaxKind.ExportKeyword)],
        "App",
        factory.createModuleBlock([constX]),
        NodeFlags.Namespace,
      ),
    ),
    ["export namespace App {", "  const x = 1;", "}"].join("\n"),
  );
};
