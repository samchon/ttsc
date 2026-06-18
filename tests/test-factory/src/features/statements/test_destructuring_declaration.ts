import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * An array-destructuring variable declaration, e.g. `const [a, b] = pair;`.
 *
 * `createVariableDeclaration` accepts a binding pattern as its name.
 */
export const test_destructuring_declaration = (): void => {
  TestValidator.equals(
    "array destructuring declaration",
    print(
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              factory.createArrayBindingPattern([
                factory.createBindingElement(undefined, undefined, "a", undefined),
                factory.createBindingElement(undefined, undefined, "b", undefined),
              ]),
              undefined,
              undefined,
              id("pair"),
            ),
          ],
          NodeFlags.Const,
        ),
      ),
    ),
    "const [a, b] = pair;",
  );
};
