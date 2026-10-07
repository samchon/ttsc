import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, print, str } from "../../internal/helpers";

/**
 * Verifies printing of `import =` declarations and namespace exports.
 *
 * `import x = require("mod")` via an external-module reference, `import y =
 * ns.Y` via an entity name, `export * as ns from "mod"`, `export as namespace
 * Lib`, and a stray `;` class element.
 *
 * 1. Import-equals require/qualified forms, namespace exports and the empty
 *    statement retain their distinct source tokens.
 * 2. Literal import x = require("mod");, import y = ns.Y; and namespace export
 *    expectations come from TypeScript grammar.
 *
 * @evidence contracts/testing.md#behavioral-verification Import-equals require/qualified forms, namespace exports and the empty statement retain their distinct source tokens.
 * @evidence contracts/testing.md#independent-expectations Literal import x = require("mod");, import y = ns.Y; and namespace export expectations come from TypeScript grammar.
 * @evidence contracts/testing.md#distinguishing-cases External module reference contrasts with qualified namespace import, star-as export, namespace declaration and empty statement.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_import_equals_and_namespace_export. Calls the corresponding import/export factory constructors and TsPrinter.print in process.
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
