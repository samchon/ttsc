import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, mod, param, print } from "../../internal/helpers";

/**
 * Print a {@link factory.createSetAccessorDeclaration|setter}.
 *
 * A `public set value(v: number) {}` accessor with an empty body.
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
