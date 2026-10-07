import { TestValidator } from "@nestia/e2e";

import factory, {
  NodeFlags,
  SyntaxKind,
} from "../../../../../packages/factory/src/index";
import { id, kw, mod, num, print } from "../../internal/helpers";

/**
 * Verifies printing of
 * {@link factory.createVariableStatement|variable statements}.
 *
 * The `const` / `let` / `var` keyword follows the declaration-list flags; a
 * typed `export const` and a `declare var x!: number` definite assignment are
 * also covered.
 *
 * 1. Const/let/var modes, export typing and declare definite-assignment markers
 *    retain their supplied tokens.
 * 2. Each explicit source literal independently specifies declaration flags, type
 *    annotation and initializer/definite marker.
 *
 * @evidence contracts/testing.md#behavioral-verification Const/let/var modes, export typing and declare definite-assignment markers retain their supplied tokens.
 * @evidence contracts/testing.md#independent-expectations Each explicit source literal independently specifies declaration flags, type annotation and initializer/definite marker.
 * @evidence contracts/testing.md#distinguishing-cases Three declaration modes, exported boolean and declared definite-assignment forms distinguish flags from shared node kind.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_variable_statement. Calls createVariableDeclarationList/createVariableDeclaration/createVariableStatement and print in process.
 */
export const test_variable_statement = (): void => {
  const decl = (name: string, flags: NodeFlags, value: string) =>
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            id(name),
            undefined,
            undefined,
            num(value),
          ),
        ],
        flags,
      ),
    );
  TestValidator.equals(
    "const",
    print(decl("x", NodeFlags.Const, "1")),
    "const x = 1;",
  );
  TestValidator.equals(
    "let",
    print(decl("y", NodeFlags.Let, "2")),
    "let y = 2;",
  );
  TestValidator.equals(
    "var",
    print(decl("z", NodeFlags.None, "3")),
    "var z = 3;",
  );
  TestValidator.equals(
    "typed export",
    print(
      factory.createVariableStatement(
        [mod(SyntaxKind.ExportKeyword)],
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              id("flag"),
              undefined,
              kw(SyntaxKind.BooleanKeyword),
              factory.createTrue(),
            ),
          ],
          NodeFlags.Const,
        ),
      ),
    ),
    "export const flag: boolean = true;",
  );
  TestValidator.equals(
    "definite assignment",
    print(
      factory.createVariableStatement(
        [mod(SyntaxKind.DeclareKeyword)],
        factory.createVariableDeclarationList([
          factory.createVariableDeclaration(
            id("x"),
            factory.createToken(SyntaxKind.ExclamationToken),
            kw(SyntaxKind.NumberKeyword),
            undefined,
          ),
        ]),
      ),
    ),
    "declare var x!: number;",
  );
};
