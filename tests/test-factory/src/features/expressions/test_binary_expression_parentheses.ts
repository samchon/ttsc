import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, SyntaxKind } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

const bin = (
  left: Expression,
  operator: SyntaxKind,
  right: Expression,
): Expression => factory.createBinaryExpression(left, operator, right);

/**
 * Verifies expression binary parenthesizer: preserves precedence and
 * associativity.
 *
 * Locks the same rules TypeScript's printer applies to binary operands. Lower
 * precedence operands, equal-precedence non-associative operands, `??` mixes,
 * and right-associative exponentiation cannot be emitted by raw recursion.
 *
 * 1. Print nested binary expressions across lower and equal precedence.
 * 2. Print exponentiation and nullish/logical mixes.
 * 3. Assert parentheses preserve the original AST grouping.
 */
export const test_binary_expression_parentheses = (): void => {
  TestValidator.equals(
    "left lower precedence",
    print(
      bin(
        bin(id("a"), SyntaxKind.PlusToken, id("b")),
        SyntaxKind.AsteriskToken,
        id("c"),
      ),
    ),
    "(a + b) * c",
  );
  TestValidator.equals(
    "right lower precedence",
    print(
      bin(
        id("a"),
        SyntaxKind.AsteriskToken,
        bin(id("b"), SyntaxKind.PlusToken, id("c")),
      ),
    ),
    "a * (b + c)",
  );
  TestValidator.equals(
    "right equal precedence non-associative",
    print(
      bin(
        id("a"),
        SyntaxKind.MinusToken,
        bin(id("b"), SyntaxKind.MinusToken, id("c")),
      ),
    ),
    "a - (b - c)",
  );
  TestValidator.equals(
    "left exponentiation",
    print(
      bin(
        bin(id("a"), SyntaxKind.AsteriskAsteriskToken, id("b")),
        SyntaxKind.AsteriskAsteriskToken,
        id("c"),
      ),
    ),
    "(a ** b) ** c",
  );
  TestValidator.equals(
    "right exponentiation",
    print(
      bin(
        id("a"),
        SyntaxKind.AsteriskAsteriskToken,
        bin(id("b"), SyntaxKind.AsteriskAsteriskToken, id("c")),
      ),
    ),
    "a ** b ** c",
  );
  TestValidator.equals(
    "left nullish logical mix",
    print(
      bin(
        bin(id("a"), SyntaxKind.BarBarToken, id("b")),
        SyntaxKind.QuestionQuestionToken,
        id("c"),
      ),
    ),
    "(a || b) ?? c",
  );
  TestValidator.equals(
    "right nullish logical mix",
    print(
      bin(
        id("a"),
        SyntaxKind.QuestionQuestionToken,
        bin(id("b"), SyntaxKind.BarBarToken, id("c")),
      ),
    ),
    "a ?? (b || c)",
  );
  TestValidator.equals(
    "right arrow",
    print(
      bin(
        id("a"),
        SyntaxKind.PlusToken,
        factory.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          undefined,
          id("x"),
        ),
      ),
    ),
    "a + (() => x)",
  );
};
