import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, print } from "../../internal/helpers";

/** Print a class expression with a single property member. */
export const test_class_expression = (): void => {
  TestValidator.equals(
    "class expression",
    print(
      factory.createClassExpression(undefined, "C", undefined, undefined, [
        factory.createPropertyDeclaration(
          undefined,
          "x",
          undefined,
          kw(SyntaxKind.NumberKeyword),
          undefined,
        ),
      ]),
    ),
    ["class C {", "  x: number;", "}"].join("\n"),
  );
};
