import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, printer } from "../../internal/helpers";

/**
 * Verifies {@link TsPrinter.printFile} composes and prints a source file.
 *
 * The result ends with a trailing newline.
 *
 * 1. TsPrinter.printFile emits main(); and its required final newline.
 * 2. Literal main(); followed by LF fixes file-level termination independently of
 *    endsWith.
 *
 * @evidence contracts/testing.md#behavioral-verification TsPrinter.printFile emits main(); and its required final newline.
 * @evidence contracts/testing.md#independent-expectations Literal main(); followed by LF fixes file-level termination independently of endsWith.
 * @evidence contracts/testing.md#distinguishing-cases File trailing newline contrasts with printNodes joining statements; the original newline guard remains alongside exact output.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_print_file. Constructs a main call statement list and calls TsPrinter.printFile in process.
 */
export const test_print_file = (): void => {
  const text = printer.printFile(undefined, [
    factory.createExpressionStatement(
      factory.createCallExpression(id("main"), undefined, []),
    ),
  ]);
  TestValidator.equals("body", text, "main();\n");
  TestValidator.predicate("trailing newline", () => text.endsWith("\n"));
};
