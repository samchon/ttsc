import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags, SyntaxKind } from "@ttsc/factory";

import { id, mod, num, print } from "../../internal/helpers";

/**
 * The `NodeFlags.Namespace` flag is accepted on a module declaration.
 *
 * The flag chooses the keyword: with it an identifier-named module prints
 * `namespace A`, without it `module A`. It used to be inert — the printer read
 * the name kind alone and always emitted `namespace` — while
 * `createModuleDeclaration` documented the opposite, so the package
 * contradicted itself and the published input did nothing (#834).
 */
export const test_namespace_flag = (): void => {
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
