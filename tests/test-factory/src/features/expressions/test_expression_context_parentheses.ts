import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, print, ref } from "../../internal/helpers";

/**
 * Verifies expression context parenthesizer: wraps operands before tight
 * contexts.
 *
 * Member access, calls, `new`, unary operators, postfix operators, non-null,
 * type assertions, and tagged templates bind tighter than binary expressions.
 * Raw recursive printing would move the context onto the wrong subexpression.
 *
 * 1. Use binary expressions as operands of tight expression contexts.
 * 2. Use an arrow function as a callable operand.
 * 3. Assert parentheses preserve the operand boundary.
 */
export const test_expression_context_parentheses = (): void => {
  const sum = () => factory.createAdd(id("a"), id("b"));

  TestValidator.equals(
    "member",
    print(factory.createPropertyAccessExpression(sum(), id("c"))),
    "(a + b).c",
  );
  TestValidator.equals(
    "call",
    print(factory.createCallExpression(sum(), undefined, [])),
    "(a + b)()",
  );
  TestValidator.equals(
    "arrow call",
    print(
      factory.createCallExpression(
        factory.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          undefined,
          id("x"),
        ),
        undefined,
        [],
      ),
    ),
    "(() => x)()",
  );
  TestValidator.equals(
    "function expression call",
    print(
      factory.createCallExpression(
        factory.createFunctionExpression(
          undefined,
          undefined,
          undefined,
          undefined,
          [],
          undefined,
          factory.createBlock([], true),
        ),
        undefined,
        [],
      ),
    ),
    "(function () {})()",
  );
  TestValidator.equals(
    "object literal member",
    print(
      factory.createPropertyAccessExpression(
        factory.createObjectLiteralExpression([]),
        id("value"),
      ),
    ),
    "({}).value",
  );
  TestValidator.equals(
    "new",
    print(
      factory.createNewExpression(
        factory.createLogicalOr(id("Factory"), id("Fallback")),
        undefined,
        [],
      ),
    ),
    "new (Factory || Fallback)()",
  );
  TestValidator.equals(
    "new call target",
    print(
      factory.createNewExpression(
        factory.createCallExpression(id("factory"), undefined, []),
        undefined,
        [],
      ),
    ),
    "new (factory())()",
  );
  TestValidator.equals(
    "prefix",
    print(
      factory.createPrefixUnaryExpression(
        SyntaxKind.ExclamationToken,
        factory.createStrictEquality(id("a"), id("b")),
      ),
    ),
    "!(a === b)",
  );
  TestValidator.equals(
    "await",
    print(factory.createAwaitExpression(sum())),
    "await (a + b)",
  );
  TestValidator.equals(
    "postfix",
    print(
      factory.createPostfixUnaryExpression(sum(), SyntaxKind.PlusPlusToken),
    ),
    "(a + b)++",
  );
  TestValidator.equals(
    "type assertion",
    print(factory.createTypeAssertion(ref("T"), sum())),
    "<T>(a + b)",
  );
  TestValidator.equals(
    "non-null member",
    print(
      factory.createPropertyAccessExpression(
        factory.createNonNullExpression(sum()),
        id("c"),
      ),
    ),
    "(a + b)!.c",
  );
  TestValidator.equals(
    "tagged template",
    print(
      factory.createTaggedTemplateExpression(
        factory.createAdd(id("tag"), id("suffix")),
        undefined,
        factory.createNoSubstitutionTemplateLiteral("value"),
      ),
    ),
    "(tag + suffix)`value`",
  );
  TestValidator.equals(
    "arrow object body",
    print(
      factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        factory.createObjectLiteralExpression([]),
      ),
    ),
    "() => ({})",
  );
  TestValidator.equals(
    "object expression statement",
    print(
      factory.createExpressionStatement(
        factory.createObjectLiteralExpression([]),
      ),
    ),
    "({});",
  );
  TestValidator.equals(
    "decorator",
    print(factory.createDecorator(factory.createAdd(id("deco"), id("suffix")))),
    "@(deco + suffix)",
  );
};
