import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print, str } from "../../internal/helpers";

/**
 * Print `import =` declarations and namespace exports.
 *
 * `import x = require("mod")` via an external-module reference, `import y =
 * ns.Y` via an entity name, `export * as ns from "mod"`, `export as namespace
 * Lib`, and a stray `;` class element.
 */
export const test_import_equals_and_namespace_export = (): void => {
  TestValidator.equals(
    "import = require",
    print(
      factory.createImportEqualsDeclaration(
        undefined,
        false,
        "x",
        factory.createExternalModuleReference(str("mod")),
      ),
    ),
    `import x = require("mod");`,
  );
  TestValidator.equals(
    "import = entity",
    print(
      factory.createImportEqualsDeclaration(
        undefined,
        false,
        "y",
        factory.createQualifiedName(id("ns"), "Y"),
      ),
    ),
    "import y = ns.Y;",
  );
  TestValidator.equals(
    "namespace re-export",
    print(
      factory.createExportDeclaration(
        undefined,
        false,
        factory.createNamespaceExport("ns"),
        "mod",
      ),
    ),
    `export * as ns from "mod";`,
  );
  TestValidator.equals(
    "export as namespace",
    print(factory.createNamespaceExportDeclaration("Lib")),
    "export as namespace Lib;",
  );
  TestValidator.equals(
    "semicolon class element",
    print(factory.createSemicolonClassElement()),
    ";",
  );
};
