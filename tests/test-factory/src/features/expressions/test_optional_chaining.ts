import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

const qd = () => factory.createToken(SyntaxKind.QuestionDotToken);

/**
 * Verifies printing of optional-chaining expressions.
 *
 * Optional property access `a?.b`, element access `a?.[k]`, call `fn?.()`, and
 * a non-null assertion `a!` within a chain.
 *
 * 1. Optional property, element, call and nonnull chain constructors retain ?. at the intended links.
 * 2. Literal chain spellings independently specify which links are optional without consulting node flags from the implementation.
 *
 * @evidence contracts/testing.md#behavioral-verification Optional property, element, call and nonnull chain constructors retain ?. at the intended links.
 * @evidence contracts/testing.md#independent-expectations Literal chain spellings independently specify which links are optional without consulting node flags from the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Property/element/call optional entry forms and nonnull continuation pin distinct chain syntax branches.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_optional_chaining. Calls createPropertyAccessChain/createElementAccessChain/createCallChain/createNonNullChain and print.
 */
export const test_optional_chaining = (): void => {
  TestValidator.equals(
    "property",
    print(factory.createPropertyAccessChain(id("a"), qd(), "b")),
    "a?.b",
  );
  TestValidator.equals(
    "element",
    print(factory.createElementAccessChain(id("a"), qd(), id("k"))),
    "a?.[k]",
  );
  TestValidator.equals(
    "call",
    print(factory.createCallChain(id("fn"), qd(), undefined, [])),
    "fn?.()",
  );
  TestValidator.equals(
    "non-null",
    print(factory.createNonNullChain(id("a"))),
    "a!",
  );
};
