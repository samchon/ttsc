import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, param, print, ref } from "../../internal/helpers";

/**
 * Print call and construct signatures inside a type literal.
 *
 * `{ (a: number): string; new (): T }` — a callable plus newable object type.
 */
export const test_signatures = (): void => {
  TestValidator.equals(
    "call & construct",
    print(
      factory.createTypeLiteralNode([
        factory.createCallSignature(
          undefined,
          [param("a", kw(SyntaxKind.NumberKeyword))],
          kw(SyntaxKind.StringKeyword),
        ),
        factory.createConstructSignature(undefined, [], ref("T")),
      ]),
    ),
    "{ (a: number): string; new (): T }",
  );
};
