import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Verifies an import clause takes the phase modifier upstream takes there.
 *
 * `createImportClause`'s first parameter was a boolean, which is the
 * `@deprecated` overload: a caller porting from current `ts.factory` passes a
 * phase modifier and has it read as `isTypeOnly`. Upstream types the slot as
 * `ImportPhaseModifierSyntaxKind`, the union of the `type` and `defer`
 * keywords, and a boolean cannot express the second one at all.
 *
 * 1. Build an ordinary import, a type-only import, and a deferred import.
 * 2. Assert each prints its own keyword, and that the ordinary one prints none.
 * 3. Assert the modifier survives alongside a default binding and named bindings
 *    together, which is the shape that has something to be placed before.
 */
export const test_import_phase_modifier = (): void => {
  const clause = (
    phase?: SyntaxKind.TypeKeyword | SyntaxKind.DeferKeyword,
  ): string =>
    print(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          phase,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(false, undefined, id("a")),
          ]),
        ),
        factory.createStringLiteral("./m"),
      ),
    );

  TestValidator.equals(
    "no phase modifier",
    clause(),
    `import { a } from "./m";`,
  );
  TestValidator.equals(
    "type-only import",
    clause(SyntaxKind.TypeKeyword),
    `import type { a } from "./m";`,
  );
  TestValidator.equals(
    "deferred import",
    clause(SyntaxKind.DeferKeyword),
    `import defer { a } from "./m";`,
  );

  TestValidator.equals(
    "phase modifier precedes both binding forms",
    print(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          SyntaxKind.TypeKeyword,
          id("Def"),
          factory.createNamedImports([
            factory.createImportSpecifier(false, undefined, id("a")),
          ]),
        ),
        factory.createStringLiteral("./m"),
      ),
    ),
    `import type Def, { a } from "./m";`,
  );
};
