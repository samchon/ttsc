import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of a default import.
 *
 * `import factory from "@ttsc/factory";`
 *
 * 1. A default factory import prints the supplied @ttsc/factory module specifier
 *    and binding.
 * 2. Literal import factory from "@ttsc/factory"; specifies generated source, not
 *    an installed-consumer import assertion.
 *
 * @evidence contracts/testing.md#behavioral-verification A default factory import prints the supplied @ttsc/factory module specifier and binding.
 * @evidence contracts/testing.md#independent-expectations Literal import factory from "@ttsc/factory"; specifies generated source, not an installed-consumer import assertion.
 * @evidence contracts/testing.md#distinguishing-cases This default-only shape complements named and combinations cases; it does not exercise package installation.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_import_default. Calls createImportDeclaration with a default ImportClause and TsPrinter.print directly.
 */
export const test_import_default = (): void => {
  TestValidator.equals(
    "default",
    print(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(undefined, id("factory"), undefined),
        "@ttsc/factory",
      ),
    ),
    'import factory from "@ttsc/factory";',
  );
};
