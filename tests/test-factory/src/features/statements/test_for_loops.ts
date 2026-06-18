import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags, SyntaxKind } from "@ttsc/factory";

import { id, num, print } from "../../internal/helpers";

const decl = (name: string, value: string, flags: NodeFlags) =>
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
  );

/**
 * Print the three `for` loop forms.
 *
 * A C-style `for (let i = 0; i < n; i++) {}`, a `for...in`, and a `for...of` —
 * the loop initializer is a declaration list, and the body is an (empty)
 * block.
 */
export const test_for_loops = (): void => {
  TestValidator.equals(
    "for",
    print(
      factory.createForStatement(
        decl("i", "0", NodeFlags.Let),
        factory.createBinaryExpression(
          id("i"),
          SyntaxKind.LessThanToken,
          id("n"),
        ),
        factory.createPostfixUnaryExpression(id("i"), SyntaxKind.PlusPlusToken),
        factory.createBlock([], true),
      ),
    ),
    "for (let i = 0; i < n; i++) {}",
  );
  TestValidator.equals(
    "for-in",
    print(
      factory.createForInStatement(
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              id("k"),
              undefined,
              undefined,
              undefined,
            ),
          ],
          NodeFlags.Const,
        ),
        id("obj"),
        factory.createBlock([], true),
      ),
    ),
    "for (const k in obj) {}",
  );
  TestValidator.equals(
    "for-of",
    print(
      factory.createForOfStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              id("x"),
              undefined,
              undefined,
              undefined,
            ),
          ],
          NodeFlags.Const,
        ),
        id("xs"),
        factory.createBlock([], true),
      ),
    ),
    "for (const x of xs) {}",
  );
};
