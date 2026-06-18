import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, num, print, ref } from "../../internal/helpers";

/** Print `delete` / `void` / `yield` and an angle-bracket type assertion. */
export const test_delete_void_yield = (): void => {
  TestValidator.equals(
    "delete",
    print(
      factory.createDeleteExpression(
        factory.createPropertyAccessExpression(id("obj"), "x"),
      ),
    ),
    "delete obj.x",
  );
  TestValidator.equals(
    "void",
    print(factory.createVoidExpression(num("0"))),
    "void 0",
  );
  TestValidator.equals(
    "yield",
    print(factory.createYieldExpression(undefined, id("v"))),
    "yield v",
  );
  TestValidator.equals(
    "yield*",
    print(
      factory.createYieldExpression(
        factory.createToken(SyntaxKind.AsteriskToken),
        factory.createCallExpression(id("gen"), undefined, []),
      ),
    ),
    "yield* gen()",
  );
  TestValidator.equals(
    "yield bare",
    print(factory.createYieldExpression(undefined, undefined)),
    "yield",
  );
  TestValidator.equals(
    "type assertion",
    print(factory.createTypeAssertion(ref("T"), id("value"))),
    "<T>value",
  );
};
