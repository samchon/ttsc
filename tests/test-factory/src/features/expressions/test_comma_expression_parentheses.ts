import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Verifies comma expression parenthesizer: wraps comma operands in delimited
 * contexts.
 *
 * Comma expressions are valid expressions, but in arrays, arguments, element
 * access, template spans, object members, and initializers they otherwise look
 * like separators and change the generated program shape.
 *
 * 1. Build comma expressions in every delimited expression context.
 * 2. Build parameter, binding, and variable initializers with comma values.
 * 3. Assert each context emits parentheses around the comma expression.
 */
export const test_comma_expression_parentheses = (): void => {
  const comma = () => factory.createComma(id("a"), id("b"));

  TestValidator.equals(
    "array element",
    print(factory.createArrayLiteralExpression([comma()])),
    "[(a , b)]",
  );
  TestValidator.equals(
    "call argument",
    print(factory.createCallExpression(id("fn"), undefined, [comma()])),
    "fn((a , b))",
  );
  TestValidator.equals(
    "arrow body",
    print(
      factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        comma(),
      ),
    ),
    "() => (a , b)",
  );
  TestValidator.equals(
    "element access argument",
    print(factory.createElementAccessExpression(id("obj"), comma())),
    "obj[(a , b)]",
  );
  TestValidator.equals(
    "template span",
    print(
      factory.createTemplateExpression(factory.createTemplateHead(""), [
        factory.createTemplateSpan(comma(), factory.createTemplateTail("")),
      ]),
    ),
    "`${(a , b)}`",
  );
  TestValidator.equals(
    "object property",
    print(
      factory.createObjectLiteralExpression([
        factory.createPropertyAssignment("x", comma()),
      ]),
    ),
    "{ x: (a , b) }",
  );
  TestValidator.equals(
    "parameter initializer",
    print(
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "x",
        undefined,
        undefined,
        comma(),
      ),
    ),
    "x = (a , b)",
  );
  TestValidator.equals(
    "binding initializer",
    print(factory.createBindingElement(undefined, undefined, "x", comma())),
    "x = (a , b)",
  );
  TestValidator.equals(
    "variable initializer",
    print(
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              "x",
              undefined,
              undefined,
              comma(),
            ),
          ],
          NodeFlags.Const,
        ),
      ),
    ),
    "const x = (a , b);",
  );
};
