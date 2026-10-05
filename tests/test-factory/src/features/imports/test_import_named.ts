import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of named imports, including an alias.
 *
 * `import { a, b as c } from "mod";`
 *
 * 1. Named imports preserve the ordinary identifier and renamed binding.
 * 2. The explicit brace-delimited import literal independently fixes alias
 *    direction and comma separation.
 *
 * @evidence contracts/testing.md#behavioral-verification Named imports preserve the ordinary identifier and renamed binding.
 * @evidence contracts/testing.md#independent-expectations The explicit brace-delimited import literal independently fixes alias direction and comma separation.
 * @evidence contracts/testing.md#distinguishing-cases Unaliased versus aliased and per-specifier type-only imports detect reversal, omitted as or missing type; default and namespace forms belong to sibling cases.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_import_named. Calls createNamedImports/createImportSpecifier and TsPrinter.print in the unit process.
 */
export const test_import_named = (): void => {
  TestValidator.equals(
    "type-only aliased specifier",
    print(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          undefined,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(true, id("Original"), "Renamed"),
          ]),
        ),
        "mod",
      ),
    ),
    'import { type Original as Renamed } from "mod";',
  );
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
