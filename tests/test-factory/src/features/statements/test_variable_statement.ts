import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags, SyntaxKind } from "@ttsc/factory";

import { id, kw, mod, num, print } from "../../internal/helpers";

/**
 * Print {@link factory.createVariableStatement|variable statements}.
 *
 * The `const` / `let` / `var` keyword follows the declaration-list flags; a
 * typed `export const` and a `declare var x!: number` definite assignment are
 * also covered.
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
