import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Exercise the source-file utilities.
 *
 * {@link factory.createNodeArray} returns its elements unchanged,
 * {@link factory.createSourceFile} prints its statements, and
 * {@link factory.updateSourceFile} swaps the statement list.
 */
export const test_source_file_helpers = (): void => {
  const arr = factory.createNodeArray([id("a"), id("b")]);
  TestValidator.equals("nodeArray", arr.length, 2);
  const file = factory.createSourceFile([
    factory.createExpressionStatement(
      factory.createCallExpression(id("a"), undefined, []),
    ),
  ]);
  const updated = factory.updateSourceFile(file, [
    factory.createExpressionStatement(
      factory.createCallExpression(id("b"), undefined, []),
    ),
  ]);
  TestValidator.equals("updated", print(updated).trim(), "b();");
};
