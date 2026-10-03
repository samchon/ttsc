import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags } from "../../../../../packages/factory/src/index";

import { id, num, printer } from "../../internal/helpers";

/**
 * Verifies {@link TsPrinter.printNodes} joins nodes with new lines.
 *
 * Two `const` statements print on consecutive lines.
 *
 * 1. TsPrinter.printNodes joins const a = 1; and const b = 2; with one newline in order.
 * 2. The exact two-statement literal specifies values, declaration modes and separator without asking another printer.
 *
 * @evidence contracts/testing.md#behavioral-verification TsPrinter.printNodes joins const a = 1; and const b = 2; with one newline in order.
 * @evidence contracts/testing.md#independent-expectations The exact two-statement literal specifies values, declaration modes and separator without asking another printer.
 * @evidence contracts/testing.md#distinguishing-cases Multiple nodes distinguish joining/order from single-source-file emission; print_file owns the final newline contract.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_print_nodes. Calls printNodes on two authored variable statements in the unit executor.
 */
export const test_print_nodes = (): void => {
  const decl = (name: string, value: string) =>
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            id(name),
            undefined,
            undefined,
            num(value),
          ),
        ],
        NodeFlags.Const,
      ),
    );
  TestValidator.equals(
    "printNodes",
    printer.printNodes([decl("a", "1"), decl("b", "2")]),
    ["const a = 1;", "const b = 2;"].join("\n"),
  );
};
