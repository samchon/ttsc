import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, kw, num, print } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createParameterDeclaration|parameter} variants.
 *
 * A rest parameter `...args: string[]`, an optional `x?: number`, and a
 * decorated parameter with a default `@inject x: number = 1`.
 *
 * 1. Rest, optional and decorated/default parameters retain their markers, type and initializer in arrow syntax.
 * 2. Literal ...args: string[], x?: number and @inject x: number = 1 expectations are authored syntax, not printer snapshots.
 *
 * @evidence contracts/testing.md#behavioral-verification Rest, optional and decorated/default parameters retain their markers, type and initializer in arrow syntax.
 * @evidence contracts/testing.md#independent-expectations Literal ...args: string[], x?: number and @inject x: number = 1 expectations are authored syntax, not printer snapshots.
 * @evidence contracts/testing.md#distinguishing-cases Rest versus optional versus initialized/decorated shapes pin different parameter branches; default marker must not become optional.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_parameter_variants. Calls createParameterDeclaration and arrow construction, then TsPrinter.print through the unit export.
 */
export const test_parameter_variants = (): void => {
  const arrow = (p: ReturnType<typeof factory.createParameterDeclaration>) =>
    print(
      factory.createArrowFunction(
        undefined,
        undefined,
        [p],
        undefined,
        undefined,
        factory.createBlock([], true),
      ),
    );
  TestValidator.equals(
    "rest",
    arrow(
      factory.createParameterDeclaration(
        undefined,
        factory.createToken(SyntaxKind.DotDotDotToken),
        "args",
        undefined,
        factory.createArrayTypeNode(kw(SyntaxKind.StringKeyword)),
        undefined,
      ),
    ),
    "(...args: string[]) => {}",
  );
  TestValidator.equals(
    "optional",
    arrow(
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "x",
        factory.createToken(SyntaxKind.QuestionToken),
        kw(SyntaxKind.NumberKeyword),
        undefined,
      ),
    ),
    "(x?: number) => {}",
  );
  TestValidator.equals(
    "decorated default",
    arrow(
      factory.createParameterDeclaration(
        [factory.createDecorator(id("inject"))],
        undefined,
        "x",
        undefined,
        kw(SyntaxKind.NumberKeyword),
        num("1"),
      ),
    ),
    "(@inject x: number = 1) => {}",
  );
};
