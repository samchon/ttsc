package linthost

import "testing"

// TestNoDuplicateImportsClassifiesInlineTypeSpecifierAsValue verifies
// `import { type Foo } from "m"` counts as a value declaration under
// `allowSeparateTypeImports: true`, not as a clause-level type import.
//
// Locks the clause-level reading of type-ness in
// `duplicateImportsImportEntry`: only `ImportClause.IsTypeOnly()`
// (`import type …`) makes a declaration type-only; an inline `type`
// modifier on a specifier leaves the import clause value-bearing. If the
// inline modifier leaked into the declaration's type-ness, the option
// would wrongly exempt this pair and the finding would disappear.
//
// 1. Import named value bindings, then an inline-type specifier, from "m".
// 2. Run the rule with `allowSeparateTypeImports: true`.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsClassifiesInlineTypeSpecifierAsValue(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
import { type Foo } from "m";
`, `{"allowSeparateTypeImports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
