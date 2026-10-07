import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { kw, mod, param, print } from "../../internal/helpers";

/**
 * Verifies printing of a {@link factory.createSetAccessorDeclaration|setter}.
 *
 * A `public set value(v: number) {}` accessor with an empty body.
 *
 * 1. The public setter prints its value name, v: number parameter and empty body.
 * 2. Literal public set value(v: number) {} fixes setter keyword and punctuation
 *    without using the implementation output.
 *
 * @evidence contracts/testing.md#behavioral-verification The public setter prints its value name, v: number parameter and empty body.
 * @evidence contracts/testing.md#independent-expectations Literal public set value(v: number) {} fixes setter keyword and punctuation without using the implementation output.
 * @evidence contracts/testing.md#distinguishing-cases An empty setter body complements the getter with a return in class_declaration; this case owns setter-specific syntax.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_set_accessor. Calls createSetAccessorDeclaration and TsPrinter.print directly.
 */
export const test_set_accessor = (): void => {
  TestValidator.equals(
    "setter",
    print(
      factory.createSetAccessorDeclaration(
        [mod(SyntaxKind.PublicKeyword)],
        "value",
        [param("v", kw(SyntaxKind.NumberKeyword))],
        factory.createBlock([], true),
      ),
    ),
    "public set value(v: number) {}",
  );
};
