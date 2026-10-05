import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";

/**
 * Verifies named, star, type-only, default and export-equals forms.
 *
 * Named export with alias, `export *`, `export type { T } from`, default
 * export, and `export =`.
 *
 * 1. Named alias, star, type-only, default and export-equals forms retain their
 *    distinct syntax.
 * 2. Literal export statements independently fix clause names, aliases and
 *    assignment/default tokens.
 *
 * @evidence contracts/testing.md#behavioral-verification Named alias, star, type-only, default and export-equals forms retain their distinct syntax.
 * @evidence contracts/testing.md#independent-expectations Literal export statements independently fix clause names, aliases and assignment/default tokens.
 * @evidence contracts/testing.md#distinguishing-cases Named/star/type-only/default/export-equals routes and per-specifier type-only and empty named exports catch wrong constructor branching; namespace exports belong to import_equals_and_namespace_export. This tests generated syntax, not module loading.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_exports. Calls export constructors and TsPrinter.print directly.
 */
export const test_exports = (): void => {
  TestValidator.equals(
    "named",
    print(
      factory.createExportDeclaration(
        undefined,
        false,
        factory.createNamedExports([
          factory.createExportSpecifier(false, undefined, "a"),
          factory.createExportSpecifier(false, "b", "c"),
        ]),
        undefined,
      ),
    ),
    "export { a, b as c };",
  );
  TestValidator.equals(
    "star",
    print(factory.createExportDeclaration(undefined, false, undefined, "mod")),
    'export * from "mod";',
  );
  TestValidator.equals(
    "type from",
    print(
      factory.createExportDeclaration(
        undefined,
        true,
        factory.createNamedExports([
          factory.createExportSpecifier(false, undefined, "T"),
        ]),
        "mod",
      ),
    ),
    'export type { T } from "mod";',
  );
  TestValidator.equals(
    "type-only aliased specifier",
    print(
      factory.createExportDeclaration(
        undefined,
        false,
        factory.createNamedExports([
          factory.createExportSpecifier(true, "Original", "Renamed"),
        ]),
        "mod",
      ),
    ),
    'export { type Original as Renamed } from "mod";',
  );
  TestValidator.equals(
    "empty named export",
    print(
      factory.createExportDeclaration(
        undefined,
        false,
        factory.createNamedExports([]),
        undefined,
      ),
    ),
    "export {};",
  );
  TestValidator.equals(
    "default",
    print(factory.createExportAssignment(undefined, false, id("value"))),
    "export default value;",
  );
  TestValidator.equals(
    "equals",
    print(factory.createExportAssignment(undefined, true, id("value"))),
    "export = value;",
  );
};
