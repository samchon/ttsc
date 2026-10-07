import { TestValidator } from "@nestia/e2e";

import factory, {
  NodeFlags,
  SyntaxKind,
} from "../../../../../packages/factory/src/index";
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
 * 1. Build an exported identifier-named module App containing `const x = 1;`, pass
 *    NodeFlags.Namespace to createModuleDeclaration and print it.
 * 2. Compare against the literal `export namespace App` declaration with a
 *    two-space indented body.
 *
 * @evidence contracts/testing.md#behavioral-verification createModuleDeclaration with NodeFlags.Namespace and an identifier name is printed by TsPrinter.print with the namespace keyword.
 * @evidence contracts/testing.md#independent-expectations The literal three-line `export namespace App` block containing `const x = 1;` is authored from TypeScript syntax and the flag contract in the doc comment, not captured from the printer.
 * @evidence contracts/testing.md#distinguishing-cases Only the flagged input is executed here, which detects an ignored flag that always emits module; the unflagged module keyword form and the string-named module are owned by test_module_namespace.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_namespace_flag. Calls createModuleDeclaration with NodeFlags.Namespace and TsPrinter.print directly in process.
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
