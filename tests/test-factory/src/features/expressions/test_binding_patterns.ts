import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { num, print } from "../../internal/helpers";

/**
 * Verifies printing of destructuring binding patterns.
 *
 * An object pattern with a renamed and a rest element, and an array pattern
 * with a default, an elision (hole), and a rest element.
 *
 * 1. Object renamed/rest bindings and array default/elision/rest bindings preserve pattern syntax and order.
 * 2. Literal object/array binding text fixes rename direction, assignment and spread markers independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Object renamed/rest bindings and array default/elision/rest bindings preserve pattern syntax and order.
 * @evidence contracts/testing.md#independent-expectations Literal object/array binding text fixes rename direction, assignment and spread markers independently.
 * @evidence contracts/testing.md#distinguishing-cases Object versus array, renamed/default elements, omitted slot and final rest cover distinct binding-element forms.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_binding_patterns. Calls createObjectBindingPattern/createArrayBindingPattern/createBindingElement and print directly.
 */
export const test_binding_patterns = (): void => {
  TestValidator.equals(
    "object pattern",
    print(
      factory.createObjectBindingPattern([
        factory.createBindingElement(undefined, undefined, "a", undefined),
        factory.createBindingElement(undefined, "b", "c", undefined),
        factory.createBindingElement(
          factory.createToken(SyntaxKind.DotDotDotToken),
          undefined,
          "rest",
          undefined,
        ),
      ]),
    ),
    "{ a, b: c, ...rest }",
  );
  TestValidator.equals(
    "array pattern",
    print(
      factory.createArrayBindingPattern([
        factory.createBindingElement(undefined, undefined, "a", num("1")),
        factory.createOmittedExpression(),
        factory.createBindingElement(
          factory.createToken(SyntaxKind.DotDotDotToken),
          undefined,
          "rest",
          undefined,
        ),
      ]),
    ),
    "[a = 1, , ...rest]",
  );
};
