import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * The nullish-coalescing assignment operator `??=`.
 *
 * `SyntaxKind.QuestionQuestionEqualsToken` renders as `??=` inside a binary
 * expression.
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
