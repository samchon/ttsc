import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies the nullish-coalescing assignment operator `??=`.
 *
 * `SyntaxKind.QuestionQuestionEqualsToken` renders as `??=` inside a binary
 * expression.
 *
 * 1. An explicit nullish-assignment token prints ??= inside its expression statement.
 * 2. Literal a ??= {}; independently fixes operator spelling and retains both operand identities.
 *
 * @evidence contracts/testing.md#behavioral-verification An explicit nullish-assignment token prints ??= inside its expression statement.
 * @evidence contracts/testing.md#independent-expectations Literal a ??= {}; independently fixes operator spelling and retains both operand identities.
 * @evidence contracts/testing.md#distinguishing-cases This case owns an explicit token-node operator; convenience alias coverage belongs to all_operator_aliases.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_nullish_assignment. Calls createBinaryExpression with a QuestionQuestionEqualsToken node, wraps it in createExpressionStatement and prints it.
 */
export const test_nullish_assignment = (): void => {
  TestValidator.equals(
    "nullish assignment",
    print(
      factory.createExpressionStatement(
        factory.createBinaryExpression(
          id("a"),
          factory.createToken(SyntaxKind.QuestionQuestionEqualsToken),
          factory.createObjectLiteralExpression([]),
        ),
      ),
    ),
    "a ??= {};",
  );
};
