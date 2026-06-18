import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

const qd = () => factory.createToken(SyntaxKind.QuestionDotToken);

/**
 * Print optional-chaining expressions.
 *
 * Optional property access `a?.b`, element access `a?.[k]`, call `fn?.()`, and
 * a non-null assertion `a!` within a chain.
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
