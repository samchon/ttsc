import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print a default import.
 *
 * `import factory from "@ttsc/factory";`
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
