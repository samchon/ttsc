import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print every export form.
 *
 * Named export with alias, `export *`, `export type { T } from`, default
 * export, and `export =`.
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
