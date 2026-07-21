import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print the remaining import forms.
 *
 * Default-plus-named, namespace `* as ns`, type-only named, type-only default,
 * and a side-effect-only import.
 */
export const test_import_combinations = (): void => {
  TestValidator.equals(
    "default + named",
    print(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          undefined,
          id("def"),
          factory.createNamedImports([
            factory.createImportSpecifier(false, undefined, "a"),
          ]),
        ),
        "mod",
      ),
    ),
    'import def, { a } from "mod";',
  );
  TestValidator.equals(
    "namespace",
    print(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          undefined,
          undefined,
          factory.createNamespaceImport("ns"),
        ),
        "mod",
      ),
    ),
    'import * as ns from "mod";',
  );
  TestValidator.equals(
    "type named",
    print(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          SyntaxKind.TypeKeyword,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(false, undefined, "T"),
          ]),
        ),
        "mod",
      ),
    ),
    'import type { T } from "mod";',
  );
  TestValidator.equals(
    "type default",
    print(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(SyntaxKind.TypeKeyword, id("T"), undefined),
        "mod",
      ),
    ),
    'import type T from "mod";',
  );
  TestValidator.equals(
    "side effect",
    print(factory.createImportDeclaration(undefined, undefined, "polyfill")),
    'import "polyfill";',
  );
};
