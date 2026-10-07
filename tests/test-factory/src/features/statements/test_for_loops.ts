import { TestValidator } from "@nestia/e2e";

import factory, {
  NodeFlags,
  SyntaxKind,
} from "../../../../../packages/factory/src/index";
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
 * Verifies printing of the three `for` loop forms.
 *
 * A C-style `for (let i = 0; i < n; i++) {}`, a `for...in`, and a `for...of` —
 * the loop initializer is a declaration list, and the body is an (empty)
 * block.
 *
 * 1. C-style, for-in and for-of loops retain their initializer, relation/update or
 *    iteration token and empty block.
 * 2. Exact loop-source literals independently specify i
 *    initialization/condition/update and k/x iteration bindings.
 *
 * @evidence contracts/testing.md#behavioral-verification C-style, for-in and for-of loops retain their initializer, relation/update or iteration token and empty block.
 * @evidence contracts/testing.md#independent-expectations Exact loop-source literals independently specify i initialization/condition/update and k/x iteration bindings.
 * @evidence contracts/testing.md#distinguishing-cases Three loop forms, omitted classic header fields and await versus ordinary for-of expose distinct control-flow branches; declaration versus expression targets have dedicated destructuring width tests.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_for_loops. Calls createForStatement/createForInStatement/createForOfStatement and print in process.
 */
export const test_for_loops = (): void => {
  TestValidator.equals(
    "omitted classic header",
    print(
      factory.createForStatement(
        undefined,
        undefined,
        undefined,
        factory.createBlock([]),
      ),
    ),
    "for (; ; ) {}",
  );
  TestValidator.equals(
    "await for-of",
    print(
      factory.createForOfStatement(
        factory.createToken(SyntaxKind.AwaitKeyword),
        id("x"),
        id("xs"),
        factory.createBlock([]),
      ),
    ),
    "for await (x of xs) {}",
  );
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
