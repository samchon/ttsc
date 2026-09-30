import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of the remaining import forms.
 *
 * Default-plus-named, namespace `* as ns`, type-only named, type-only default,
 * and a side-effect-only import.
 *
 * 1. Default/named, namespace, type-only and side-effect imports preserve each supplied clause combination.
 * 2. Each literal import line independently fixes clause spelling, aliases and the module string.
 *
 * @evidence contracts/testing.md#behavioral-verification Default/named, namespace, type-only and side-effect imports preserve each supplied clause combination.
 * @evidence contracts/testing.md#independent-expectations Each literal import line independently fixes clause spelling, aliases and the module string.
 * @evidence contracts/testing.md#distinguishing-cases Absent bindings, default+named, namespace and type-only combinations pin different clause branches; fragment printing does not promise type-checkable imports.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_import_combinations. Calls createImportDeclaration and binding constructors then TsPrinter.print in process.
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
