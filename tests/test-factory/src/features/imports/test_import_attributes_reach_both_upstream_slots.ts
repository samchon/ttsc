import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print, str } from "../../internal/helpers";

/**
 * Verifies the two factories that upstream gives an `attributes` parameter
 * accept and print one.
 *
 * `createImportTypeNode` took `isTypeOf` last and had no `attributes` slot at
 * all, and `createJSDocImportTag` had none either — so a caller ported from
 * `ts.factory` bound its attributes to whatever parameter happened to sit in
 * that position, and its comment to the one after. Both now take the parameter
 * where upstream does.
 *
 * The two spell the attributes differently, which is why each is asserted
 * rather than assumed: an import type carries them as a second call argument,
 * and an `@import` tag carries the trailing `with { … }` an import declaration
 * uses.
 *
 * 1. Build an import type with attributes and a qualifier.
 * 2. Build an `@import` JSDoc tag with attributes.
 * 3. Assert each prints its own form, and that omitting attributes changes nothing
 *    about the rest.
 */
export const test_import_attributes_reach_both_upstream_slots = (): void => {
  const attributes = factory.createImportAttributes(
    [factory.createImportAttribute(id("type"), str("json"))],
    false,
  );

  TestValidator.equals(
    "import type carries attributes as a call argument",
    print(
      factory.createImportTypeNode(
        false,
        factory.createLiteralTypeNode(str("mod")),
        attributes,
        id("Foo"),
      ),
    ),
    `import("mod", { with: { type: "json" } }).Foo`,
  );
  TestValidator.equals(
    "import type without attributes is unchanged",
    print(
      factory.createImportTypeNode(
        false,
        factory.createLiteralTypeNode(str("mod")),
        undefined,
        id("Foo"),
      ),
    ),
    `import("mod").Foo`,
  );

  TestValidator.equals(
    "@import tag carries the trailing with clause",
    print(
      factory.createJSDocImportTag(
        undefined,
        factory.createImportClause(
          undefined,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(false, undefined, id("a")),
          ]),
        ),
        str("m"),
        attributes,
      ),
    ),
    `@import { a } from "m" with { type: "json" }`,
  );
};
