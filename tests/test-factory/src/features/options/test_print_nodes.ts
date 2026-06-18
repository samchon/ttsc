import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags } from "@ttsc/factory";

import { id, num, printer } from "../../internal/helpers";

/**
 * {@link TsPrinter.printNodes} joins nodes with new lines.
 *
 * Two `const` statements print on consecutive lines.
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
