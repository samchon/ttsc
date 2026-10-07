import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";

/**
 * Verifies the source-file utilities.
 *
 * {@link factory.createNodeArray} returns its elements unchanged,
 * {@link factory.createSourceFile} prints its statements, and
 * {@link factory.updateSourceFile} swaps the statement list.
 *
 * 1. Node arrays preserve length, spelling, order and element identity; updating a
 *    source file prints b() without changing original a().
 * 2. Literal a/b names and original object identity establish preservation
 *    independently; exact a(); and b(); expectations expose wrong replacement.
 *
 * @evidence contracts/testing.md#behavioral-verification Node arrays preserve length, spelling, order and element identity; updating a source file prints b() without changing original a().
 * @evidence contracts/testing.md#independent-expectations Literal a/b names and original object identity establish preservation independently; exact a(); and b(); expectations expose wrong replacement.
 * @evidence contracts/testing.md#distinguishing-cases Empty and two-element arrays plus old/new source outputs distinguish destructive update and copied/reordered elements.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_source_file_helpers. Calls createNodeArray, createSourceFile, updateSourceFile and TsPrinter.print directly.
 */
export const test_source_file_helpers = (): void => {
  const arr = factory.createNodeArray([id("a"), id("b")]);
  TestValidator.equals("nodeArray", arr.length, 2);
  TestValidator.equals("nodeArray values and order", arr.map(print), [
    "a",
    "b",
  ]);
  const first = id("first");
  const second = id("second");
  const identities = factory.createNodeArray([first, second]);
  TestValidator.equals(
    "nodeArray retains first identity",
    identities[0] === first,
    true,
  );
  TestValidator.equals(
    "nodeArray retains second identity",
    identities[1] === second,
    true,
  );
  TestValidator.equals(
    "empty nodeArray",
    factory.createNodeArray([]).length,
    0,
  );
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
  TestValidator.equals(
    "original source remains intact",
    print(file).trim(),
    "a();",
  );
};
