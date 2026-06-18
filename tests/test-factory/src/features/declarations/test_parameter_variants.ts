import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, kw, num, print } from "../../internal/helpers";

/**
 * Print {@link factory.createParameterDeclaration|parameter} variants.
 *
 * A rest parameter `...args: string[]`, an optional `x?: number`, and a
 * decorated parameter with a default `@inject x: number = 1`.
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
