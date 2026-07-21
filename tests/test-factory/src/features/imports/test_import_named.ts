import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print named imports, including an alias.
 *
 * `import { a, b as c } from "mod";`
 */
export const test_import_named = (): void => {
  TestValidator.equals(
    "named",
    print(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          undefined,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(false, undefined, "a"),
            factory.createImportSpecifier(false, id("b"), "c"),
          ]),
        ),
        "mod",
      ),
    ),
    'import { a, b as c } from "mod";',
  );
};
