import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags } from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies an array-destructuring variable declaration, e.g. `const [a, b] = pair;`.
 *
 * `createVariableDeclaration` accepts a binding pattern as its name.
 *
 * 1. A const array binding declaration retains a/b binding order and pair initializer.
 * 2. Literal const [a, b] = pair; independently fixes mode, pattern and assignment syntax.
 *
 * @evidence contracts/testing.md#behavioral-verification A const array binding declaration retains a/b binding order and pair initializer.
 * @evidence contracts/testing.md#independent-expectations Literal const [a, b] = pair; independently fixes mode, pattern and assignment syntax.
 * @evidence contracts/testing.md#distinguishing-cases This binding-pattern declaration complements object/array binding fragment tests and width/rest/elision branches; it owns statement integration.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_destructuring_declaration. Calls createVariableStatement/createVariableDeclarationList/createArrayBindingPattern then print.
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
                factory.createBindingElement(
                  undefined,
                  undefined,
                  "a",
                  undefined,
                ),
                factory.createBindingElement(
                  undefined,
                  undefined,
                  "b",
                  undefined,
                ),
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
