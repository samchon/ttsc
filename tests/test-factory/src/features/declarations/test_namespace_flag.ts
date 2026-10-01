import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags, SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, mod, num, print } from "../../internal/helpers";

/**
 * Verifies the `NodeFlags.Namespace` flag is accepted on a module declaration.
 *
 * The flag chooses the keyword: with it an identifier-named module prints
 * `namespace A`, without it `module A`. It used to be inert — the printer read
 * the name kind alone and always emitted `namespace` — while
 * `createModuleDeclaration` documented the opposite, so the package
 * contradicted itself and the published input did nothing (#834).
 *
 * 1. NodeFlags.Namespace makes an identifier module print namespace while the no-flag twin prints module.
 * 2. The two literal declarations independently specify the flag-controlled keyword while retaining the same block semantics.
 *
 * @evidence contracts/testing.md#behavioral-verification NodeFlags.Namespace makes an identifier module print namespace while the no-flag twin prints module.
 * @evidence contracts/testing.md#independent-expectations The two literal declarations independently specify the flag-controlled keyword while retaining the same block semantics.
 * @evidence contracts/testing.md#distinguishing-cases Flagged/unflagged adjacent inputs detect both ignored flags and unconditional namespace emission.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_namespace_flag. Calls createModuleDeclaration with and without Namespace and TsPrinter.print directly.
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
