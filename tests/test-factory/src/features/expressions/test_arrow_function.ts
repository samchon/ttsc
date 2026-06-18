import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, kw, num, param, print } from "../../internal/helpers";

/**
 * Print {@link factory.createArrowFunction|arrow functions}.
 *
 * A concise-body arrow `(x: number): number => x * 2` and a block-body arrow
 * whose body always breaks onto its own lines.
 */
export const test_arrow_function = (): void => {
  TestValidator.equals(
    "expr body",
    print(
      factory.createArrowFunction(
        undefined,
        undefined,
        [param("x", kw(SyntaxKind.NumberKeyword))],
        kw(SyntaxKind.NumberKeyword),
        undefined,
        factory.createBinaryExpression(
          id("x"),
          SyntaxKind.AsteriskToken,
          num("2"),
        ),
      ),
    ),
    "(x: number): number => x * 2",
  );
  TestValidator.equals(
    "block body",
    print(
      factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        factory.createBlock([factory.createReturnStatement(num("1"))], true),
      ),
    ),
    ["() => {", "  return 1;", "}"].join("\n"),
  );
};
